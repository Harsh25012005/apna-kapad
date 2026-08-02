import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { FontAwesome5 } from '@expo/vector-icons';
import { Header, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { customersRepo, ordersRepo } from '../../lib/data/repository';
import { sendWhatsAppMessage, buildAiOrderConfirmationMessage } from '../../lib/whatsapp';
import { useShop } from '../../context/AuthContext';
import { fieldDefMatchesGarment } from '../../lib/measurementFieldScope';
import {
  parseYesNo,
  parseClientType,
  parseGarmentChoice,
  extractFirstNumber,
  extractPhoneNumber,
  extractNameAroundPhone,
  cleanSpokenName,
  customerNameMatches,
  parseClothCounts,
} from '../../lib/aiAssistant/gujaratiNlu';
import type { DashboardScreenProps } from '../../navigation/types';
import type { Tables } from '../../lib/database.types';

type Customer = Tables<'customers'>;
type FieldDefinition = Tables<'measurement_field_definitions'>;

type Step =
  | 'greeting'
  | 'askIntent'
  | 'askClientType'
  | 'collectNewClient'
  | 'collectNewClientPhoneOnly'
  | 'collectExistingClientSearch'
  | 'chooseClientFromList'
  | 'confirmCreateNewFallback'
  | 'askMeasurementOrOrder'
  | 'askGarmentForMeasurement'
  | 'collectMeasurementField'
  | 'confirmMeasurementDone'
  | 'askClothCount'
  | 'askTotalAmount'
  | 'askDiscount'
  | 'confirmWhatsApp'
  | 'done';

type LogEntry = { who: 'ai' | 'user'; text: string };

/** Same numbering scheme as OrderFormScreen's nextOrderNumber — highest existing "ORD-N" + 1. */
async function nextOrderNumber(shopId: string): Promise<string> {
  const orders = await ordersRepo.list(shopId);
  const highest = orders.reduce((max, row) => {
    const n = Number(row.order_number?.match(/(\d+)$/)?.[1] ?? 0);
    return n > max ? n : max;
  }, 0);
  return `ORD-${highest + 1}`;
}

/** All the state accumulated across the conversation — kept out of React state
 * since it's only ever read/written from the step-advance handler, never rendered directly. */
type Session = {
  fieldDefinitions: FieldDefinition[];
  /** fieldDefinitions filtered to the garment type picked at
   * askGarmentForMeasurement — the list actually walked field-by-field. */
  activeFieldDefinitions: FieldDefinition[];
  customer: Customer | null;
  matches: Customer[];
  garmentType: string;
  fieldValues: Record<string, string>;
  fieldIndex: number;
  measurementId: string | null;
  clothType: string;
  clothCount: number;
  totalAmount: number;
  lastOrderNumber: string;
  /** The cleaned name from a failed existing-client search — reused so the
   * new-client fallback doesn't make the owner repeat the name. */
  pendingName: string;
};

function newSession(): Session {
  return {
    fieldDefinitions: [],
    activeFieldDefinitions: [],
    customer: null,
    matches: [],
    garmentType: '',
    fieldValues: {},
    fieldIndex: 0,
    measurementId: null,
    clothType: '',
    clothCount: 0,
    totalAmount: 0,
    lastOrderNumber: '',
    pendingName: '',
  };
}

export default function AIOrderAssistantScreen({ navigation }: DashboardScreenProps<'AIOrderAssistant'>) {
  const shop = useShop();
  const showToast = useToast();

  const [log, setLog] = useState<LogEntry[]>([]);
  const [step, setStep] = useState<Step>('greeting');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const session = useRef<Session>(newSession());
  const scrollRef = useRef<ScrollView>(null);

  // Hides the bottom tab bar while this full-screen conversation is open —
  // see CustomTabBar's descriptor-based display:none check.
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    }, [navigation])
  );

  const appendLog = useCallback((entry: LogEntry) => {
    setLog((prev) => [...prev, entry]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  /** Speaks a line in Gujarati, logs it, then opens the mic for the reply
   * (unless this is a terminal line). `lang` picks the recognizer language
   * for that reply — client names/phone numbers are typically spoken or
   * stored in English/Latin script, so those prompts listen in en-IN while
   * everything else listens in gu-IN. */
  const speak = useCallback(
    (text: string, opts?: { listenAfter?: boolean; lang?: 'gu-IN' | 'en-IN' }) => {
      appendLog({ who: 'ai', text });
      const listenAfter = opts?.listenAfter ?? true;
      const lang = opts?.lang ?? 'gu-IN';
      Speech.speak(text, {
        language: 'gu-IN',
        onDone: () => {
          if (listenAfter) void startListening(lang);
        },
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [appendLog]
  );

  const startListening = async (lang: 'gu-IN' | 'en-IN' = 'gu-IN') => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      showToast('માઈક્રોફોનની પરવાનગી જરૂરી છે', 'error');
      return;
    }
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang, interimResults: false, continuous: false });
  };
  const stopListening = () => ExpoSpeechRecognitionModule.stop();

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) void handleUserReply(transcript);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));

  // Kick off the conversation once, on mount.
  useEffect(() => {
    void loadFieldDefinitions().then(() => {
      const ownerName = shop.owner_name || shop.shop_name || 'શેઠ';
      speak(`નમસ્તે ${ownerName}! આજે શું કરીશું? નવો ઓર્ડર બનાવવો છે?`);
      setStep('askIntent');
    });
    return () => {
      Speech.stop();
      ExpoSpeechRecognitionModule.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFieldDefinitions = async () => {
    const { data } = await supabase
      .from('measurement_field_definitions')
      .select('*')
      .eq('shop_id', shop.id)
      .order('sort_order', { ascending: true });
    session.current.fieldDefinitions = data ?? [];
  };

  const handleUserReply = async (transcript: string) => {
    appendLog({ who: 'user', text: transcript });
    setBusy(true);
    try {
      await advance(transcript);
    } catch (err) {
      speak('માફ કરશો, કંઈક ભૂલ થઈ. ફરી પ્રયત્ન કરો.');
      showToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const advance = async (text: string) => {
    const s = session.current;

    switch (step) {
      // Only one flow exists (create order), so any reply here just moves on.
      case 'askIntent': {
        setStep('askClientType');
        speak('ગ્રાહક નવો છે કે જૂનો? અથવા ખબર નથી એમ કહો.');
        return;
      }

      case 'askClientType': {
        const type = parseClientType(text);
        if (type === 'new') {
          setStep('collectNewClient');
          speak('ગ્રાહકનું નામ અને મોબાઈલ નંબર બોલો.', { lang: 'en-IN' });
        } else if (type === 'existing' || type === 'unknown') {
          setStep('collectExistingClientSearch');
          speak('ગ્રાહકનું નામ બોલો.', { lang: 'en-IN' });
        } else {
          speak('માફ કરશો, નવો, જૂનો, કે ખબર નથી — એમાંથી એક બોલો.');
        }
        return;
      }

      case 'collectNewClient': {
        const phone = extractPhoneNumber(text);
        if (!phone) {
          speak('મોબાઈલ નંબર ના મળ્યો. ફરી નામ અને 10 આંકડાનો નંબર બોલો.', { lang: 'en-IN' });
          return;
        }
        const name = extractNameAroundPhone(text, phone) || 'ગ્રાહક';
        const customer = await customersRepo.create({ shop_id: shop.id, name, phone });
        s.customer = customer;
        setStep('askMeasurementOrOrder');
        speak(`${name} ઉમેરાયા. માપ બદલવું છે કે ઓર્ડર બનાવવો છે?`);
        return;
      }

      case 'collectExistingClientSearch': {
        // Names are typically typed/stored in English even though the rest
        // of the conversation is Gujarati, so the search itself is
        // language-agnostic: it matches against both the raw transcript and
        // a cleaned version, whichever script the recognizer produced.
        s.pendingName = cleanSpokenName(text);
        const all = await customersRepo.list(shop.id);
        const matches = all.filter((c) => customerNameMatches(text, c.name));
        if (matches.length === 0) {
          setStep('confirmCreateNewFallback');
          speak('કોઈ ગ્રાહક ના મળ્યો. નવો ગ્રાહક બનાવીએ?');
        } else if (matches.length === 1) {
          s.customer = matches[0];
          setStep('askMeasurementOrOrder');
          speak(`${matches[0].name} મળ્યા. માપ બદલવું છે કે ઓર્ડર બનાવવો છે?`);
        } else {
          // Every match is read out, not just the first few, so the owner
          // never loses a client that happens to be lower in the list.
          s.matches = matches;
          const list = s.matches.map((c, i) => `${i + 1}. ${c.name}`).join(', ');
          setStep('chooseClientFromList');
          speak(`આ નામ મળ્યા: ${list}. કયો નંબર પસંદ કરો છો? અથવા આમાંથી કોઈ ના હોય તો "નવો ગ્રાહક" બોલો.`, {
            lang: 'en-IN',
          });
        }
        return;
      }

      case 'chooseClientFromList': {
        // The right client might not be in the list at all — "નવો ગ્રાહક" /
        // "new" bails straight into creating a new one instead of forcing a
        // number pick.
        if (parseClientType(text) === 'new') {
          if (s.pendingName) {
            setStep('collectNewClientPhoneOnly');
            speak(`ઠીક છે, ${s.pendingName} નામે નવો ગ્રાહક બનાવીએ. મોબાઈલ નંબર બોલો.`, { lang: 'en-IN' });
          } else {
            setStep('collectNewClient');
            speak('ગ્રાહકનું નામ અને મોબાઈલ નંબર બોલો.', { lang: 'en-IN' });
          }
          return;
        }

        const idx = extractFirstNumber(text);
        const picked = idx ? s.matches[idx - 1] : undefined;
        if (!picked) {
          speak('માફ કરશો, નંબર બોલો — 1, 2, વગેરે. અથવા "નવો ગ્રાહક" બોલો.', { lang: 'en-IN' });
          return;
        }
        s.customer = picked;
        setStep('askMeasurementOrOrder');
        speak(`${picked.name} પસંદ થયા. માપ બદલવું છે કે ઓર્ડર બનાવવો છે?`);
        return;
      }

      case 'confirmCreateNewFallback': {
        const yes = parseYesNo(text);
        if (yes === true) {
          if (s.pendingName) {
            setStep('collectNewClientPhoneOnly');
            speak(`ઠીક છે, ${s.pendingName} નામે નવો ગ્રાહક બનાવીએ. મોબાઈલ નંબર બોલો.`, { lang: 'en-IN' });
          } else {
            setStep('collectNewClient');
            speak('ગ્રાહકનું નામ અને મોબાઈલ નંબર બોલો.', { lang: 'en-IN' });
          }
        } else {
          setStep('done');
          speak('ઠીક છે. જ્યારે તૈયાર હો ત્યારે ફરી બોલાવજો.', { listenAfter: false });
        }
        return;
      }

      case 'collectNewClientPhoneOnly': {
        const phone = extractPhoneNumber(text);
        if (!phone) {
          speak('મોબાઈલ નંબર ના મળ્યો. ફરી 10 આંકડાનો નંબર બોલો.', { lang: 'en-IN' });
          return;
        }
        const name = s.pendingName || 'ગ્રાહક';
        const customer = await customersRepo.create({ shop_id: shop.id, name, phone });
        s.customer = customer;
        setStep('askMeasurementOrOrder');
        speak(`${name} ઉમેરાયા. માપ બદલવું છે કે ઓર્ડર બનાવવો છે?`);
        return;
      }

      case 'askMeasurementOrOrder': {
        if (/માપ|maap|measurement/i.test(text)) {
          if (s.fieldDefinitions.length === 0) {
            speak('કોઈ માપ ફીલ્ડ સેટ નથી. સેટિંગ્સ માંથી ઉમેરો. હવે ઓર્ડર બનાવીએ. કેટલા કપડાં છે?');
            setStep('askClothCount');
            return;
          }
          setStep('askGarmentForMeasurement');
          speak('શર્ટ નું માપ કે પેન્ટ નું માપ? બંને હોય તો બંને બોલો.');
        } else if (/ઓર્ડર|order/i.test(text)) {
          setStep('askClothCount');
          speak('કેટલા કપડાં છે? શર્ટ, પેન્ટ કે જોડ બોલો.');
        } else {
          speak('માફ કરશો, "માપ" કે "ઓર્ડર" બોલો.');
        }
        return;
      }

      case 'askGarmentForMeasurement': {
        const garment = parseGarmentChoice(text);
        if (!garment) {
          speak('શર્ટ કે પેન્ટ, કયું માપ બોલો.');
          return;
        }
        s.garmentType = garment;
        s.activeFieldDefinitions = s.fieldDefinitions.filter((d) => fieldDefMatchesGarment(d.garment_type, garment));
        s.fieldIndex = 0;
        s.fieldValues = {};
        if (s.activeFieldDefinitions.length === 0) {
          speak(`${garment} માટે કોઈ માપ ફીલ્ડ સેટ નથી. સેટિંગ્સ માંથી ઉમેરો. હવે ઓર્ડર બનાવીએ. કેટલા કપડાં છે?`);
          setStep('askClothCount');
          return;
        }
        setStep('collectMeasurementField');
        speak(s.activeFieldDefinitions[0].label + '?');
        return;
      }

      case 'collectMeasurementField': {
        const def = s.activeFieldDefinitions[s.fieldIndex];
        const value = extractFirstNumber(text);
        if (def && value !== null) {
          s.fieldValues[def.field_key] = String(value);
        }
        s.fieldIndex += 1;
        if (s.fieldIndex < s.activeFieldDefinitions.length) {
          speak(s.activeFieldDefinitions[s.fieldIndex].label + '?');
          return;
        }

        // All fields collected — save the measurement.
        const customFields = s.activeFieldDefinitions
          .filter((def2) => s.fieldValues[def2.field_key] !== undefined)
          .map((def2) => ({ label: def2.label, value: s.fieldValues[def2.field_key] }));
        const { data, error } = await supabase
          .from('measurements')
          .insert({
            shop_id: shop.id,
            customer_id: s.customer!.id,
            garment_type: s.garmentType,
            custom_fields: customFields,
          })
          .select('id')
          .single();
        if (error) throw error;
        s.measurementId = data.id;

        setStep('confirmMeasurementDone');
        speak('માપ સેવ થઈ ગયું. હવે ઓર્ડર બનાવીએ?');
        return;
      }

      case 'confirmMeasurementDone': {
        const yes = parseYesNo(text);
        if (yes === false) {
          setStep('done');
          speak('ઠીક છે. જ્યારે તૈયાર હો ત્યારે ફરી બોલાવજો.', { listenAfter: false });
          return;
        }
        setStep('askClothCount');
        speak('કેટલા કપડાં છે? શર્ટ, પેન્ટ કે જોડ બોલો.');
        return;
      }

      case 'askClothCount': {
        const { shirtCount, pantCount } = parseClothCounts(text);
        const clothCount = shirtCount + pantCount;
        const clothType = shirtCount > 0 && pantCount > 0 ? 'Shirt+Pant' : shirtCount > 0 ? 'Shirt' : 'Pant';
        s.clothCount = clothCount || 1;
        s.clothType = clothType;
        setStep('askTotalAmount');
        speak('કુલ રકમ કેટલી છે?');
        return;
      }

      case 'askTotalAmount': {
        const amount = extractFirstNumber(text);
        if (amount === null) {
          speak('માફ કરશો, રકમ ફરી બોલો.');
          return;
        }
        s.totalAmount = amount;
        setStep('askDiscount');
        speak('કોઈ ડિસ્કાઉન્ટ આપવો છે? રકમ બોલો, અથવા ના કહો.');
        return;
      }

      case 'askDiscount': {
        const no = parseYesNo(text) === false;
        const discount = no ? 0 : extractFirstNumber(text) ?? 0;
        const net = Math.max(s.totalAmount - discount, 0);

        const orderNumber = await nextOrderNumber(shop.id);
        const order = await ordersRepo.create(
          shop.id,
          {
            order_number: orderNumber,
            customer_id: s.customer!.id,
            cloth_type: s.clothType,
            cloth_count: s.clothCount,
            measurement_id: s.measurementId,
            total_amount: net,
          },
          [
            {
              garment_type: s.clothType,
              cloth_count: s.clothCount,
              unit_price: net,
              measurement_id: s.measurementId,
            },
          ]
        );
        s.totalAmount = net;
        s.lastOrderNumber = order.order_number;

        setStep('confirmWhatsApp');
        speak(`ઓર્ડર #${order.order_number} બની ગયો છે. કુલ રકમ ₹${net}. WhatsApp પર મોકલું?`);
        return;
      }

      case 'confirmWhatsApp': {
        const yes = parseYesNo(text);
        const orderNumber = s.lastOrderNumber;
        if (yes === true && s.customer) {
          try {
            const message = buildAiOrderConfirmationMessage({
              shopName: shop.shop_name || '',
              customerName: s.customer.name,
              orderNumber,
              clothType: s.clothType,
              clothCount: s.clothCount,
              totalAmount: s.totalAmount,
            });
            await sendWhatsAppMessage(s.customer.phone, message);
            speak('WhatsApp મોકલી દીધો. આભાર!', { listenAfter: false });
          } catch {
            speak('WhatsApp મોકલી ના શકાયો. આભાર!', { listenAfter: false });
          }
        } else {
          speak('ઠીક છે. આભાર!', { listenAfter: false });
        }
        setStep('done');
        return;
      }

      default:
        return;
    }
  };

  const restart = () => {
    session.current = newSession();
    setLog([]);
    void loadFieldDefinitions().then(() => {
      const ownerName = shop.owner_name || shop.shop_name || 'શેઠ';
      setStep('askIntent');
      speak(`નમસ્તે ${ownerName}! આજે શું કરીશું? નવો ઓર્ડર બનાવવો છે?`);
    });
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <Header title="AI સહાયક" onBack={() => navigation.goBack()} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        {log.map((entry, i) => (
          <View
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              entry.who === 'ai'
                ? 'self-start rounded-tl-sm bg-primary-50 dark:bg-primary-950'
                : 'self-end rounded-tr-sm bg-gray-100 dark:bg-gray-800'
            }`}
          >
            <Text className="font-sans text-base text-gray-900 dark:text-gray-50">{entry.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="items-center gap-3 border-t border-gray-100 px-6 py-6 dark:border-gray-800">
        {step === 'done' ? (
          <Pressable
            onPress={restart}
            className="flex-row items-center gap-2 rounded-full bg-primary-600 px-6 py-3.5 active:bg-primary-700"
          >
            <FontAwesome5 name="redo" size={14} color="#FFFFFF" />
            <Text className="text-base font-semibold text-white">નવી વાતચીત શરૂ કરો</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => (listening ? stopListening() : startListening())}
            disabled={busy}
            className={`h-16 w-16 items-center justify-center rounded-full ${
              listening ? 'bg-danger' : busy ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary-600'
            }`}
          >
            <FontAwesome5 name="microphone" size={22} color="#FFFFFF" />
          </Pressable>
        )}
        <Text className="font-sans text-base text-gray-500 dark:text-gray-400">
          {listening ? 'સાંભળી રહ્યા છીએ...' : busy ? 'વિચારી રહ્યા છીએ...' : 'બોલવા માટે માઈક દબાવો'}
        </Text>
      </View>
    </View>
  );
}
