import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  CenterModal,
  Checkbox,
  DatePickerField,
  Dropdown,
  EmptyState,
  GoogleIcon,
  Header,
  ImagePickerField,
  InputField,
  LoadingSpinner,
  RadioGroup,
  ToastProvider,
  Toggle,
  useToast,
} from '../components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <Text className="mb-3 text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
        {title}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

export default function ComponentShowcaseScreen() {
  const showToast = useToast();

  // State for interactive components
  const [textVal, setTextVal] = useState('');
  const [emailVal, setEmailVal] = useState('user@example.com');
  const [passVal, setPassVal] = useState('password123');
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [toggleVal, setToggleVal] = useState(true);
  const [radioVal, setRadioVal] = useState<'upi' | 'cash' | 'card'>('upi');
  const [dropdownVal, setDropdownVal] = useState<string>('shirt');
  const [dateVal, setDateVal] = useState<Date | null>(new Date());
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Modal states
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [centerModalVisible, setCenterModalVisible] = useState(false);

  return (
    <View className="flex-1 bg-gray-50">
      <Header title="UI Component Showcase" showBack />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
          All Design System & UI Components
        </Text>

        {/* 1. BUTTONS */}
        <Section title="1. Buttons (Variants & Sizes)">
          <Text className="text-xs font-medium text-gray-500 mb-1">Primary Buttons</Text>
          <Button title="Primary Button (md)" onPress={() => showToast('Primary Pressed', 'info')} />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                title="Small"
                size="sm"
                onPress={() => showToast('Small Button Pressed', 'info')}
              />
            </View>
            <View className="flex-1">
              <Button
                title="Large"
                size="lg"
                onPress={() => showToast('Large Button Pressed', 'info')}
              />
            </View>
          </View>

          <Text className="text-xs font-medium text-gray-500 mt-2 mb-1">Secondary & Outline</Text>
          <Button
            title="Secondary Button"
            variant="secondary"
            onPress={() => showToast('Secondary Pressed', 'info')}
          />
          <Button
            title="Outline Button"
            variant="outline"
            onPress={() => showToast('Outline Pressed', 'info')}
          />

          <Text className="text-xs font-medium text-gray-500 mt-2 mb-1">Danger, Google & Icon Buttons</Text>
          <Button
            title="Danger Button"
            variant="danger"
            onPress={() => showToast('Danger Pressed', 'error')}
          />
          <Button
            title="Continue with Google"
            variant="google"
            icon={<GoogleIcon size={20} />}
            onPress={() => showToast('Google Pressed', 'info')}
          />
          <Button
            title="Button with Icon"
            icon={<FontAwesome5 name="plus" size={16} color="#FFFFFF" />}
            onPress={() => showToast('Icon Button Pressed', 'success')}
          />

          <Text className="text-xs font-medium text-gray-500 mt-2 mb-1">Loading & Disabled States</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button title="Loading" loading onPress={() => {}} />
            </View>
            <View className="flex-1">
              <Button title="Disabled" disabled onPress={() => {}} />
            </View>
          </View>
        </Section>

        {/* 2. INPUT FIELDS */}
        <Section title="2. Input Fields">
          <InputField
            label="Standard Input"
            placeholder="Type something..."
            value={textVal}
            onChangeText={setTextVal}
            helperText="This is a helper text"
          />
          <InputField
            label="Email Input"
            placeholder="Enter your email"
            value={emailVal}
            onChangeText={setEmailVal}
          />
          <InputField
            label="Password Input (Toggle Hide/Show)"
            placeholder="••••••••"
            secureTextEntry
            value={passVal}
            onChangeText={setPassVal}
          />
          <InputField
            label="Input with Error State"
            placeholder="Invalid field"
            value="Wrong Input"
            onChangeText={() => {}}
            error="Please enter a valid value"
          />
          <InputField
            label="Multiline Textarea"
            placeholder="Enter customer notes or measurements..."
            multiline
            value="Chest: 40 in, Waist: 34 in, Length: 28 in"
            onChangeText={() => {}}
          />
        </Section>

        {/* 3. BADGES */}
        <Section title="3. Badges (Status & Custom)">
          <Text className="text-xs font-medium text-gray-500 mb-1">Order Status Badges</Text>
          <View className="flex-row flex-wrap gap-2">
            <Badge type="order_status" value="order_taken" />
            <Badge type="order_status" value="cutting" />
            <Badge type="order_status" value="stitching" />
            <Badge type="order_status" value="ready" />
            <Badge type="order_status" value="delivered" />
          </View>

          <Text className="text-xs font-medium text-gray-500 mt-3 mb-1">Payment Status Badges</Text>
          <View className="flex-row flex-wrap gap-2">
            <Badge type="payment_status" value="paid" />
            <Badge type="payment_status" value="partial" />
            <Badge type="payment_status" value="unpaid" />
          </View>

          <Text className="text-xs font-medium text-gray-500 mt-3 mb-1">Custom Label Badges</Text>
          <View className="flex-row flex-wrap gap-2">
            <Badge label="New Customer" bg="#DBEAFE" color="#1E40AF" />
            <Badge label="VIP" bg="#FEF3C7" color="#92400E" />
            <Badge label="Urgent" bg="#FEE2E2" color="#991B1B" />
          </View>
        </Section>

        {/* 4. CARDS */}
        <Section title="4. Cards">
          <Card>
            <Text className="font-bold text-gray-900">Standard Card Container</Text>
            <Text className="font-sans text-sm text-gray-500 mt-1">
              Used across the app to group order info, customer details, and stats.
            </Text>
          </Card>

          <Card onPress={() => showToast('Clickable Card Pressed!', 'success')}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-bold text-gray-900">Clickable Interactive Card</Text>
                <Text className="font-sans text-xs text-gray-500">Tap to test press feedback</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={14} color="#9CA3AF" />
            </View>
          </Card>
        </Section>

        {/* 5. CHECKBOX & TOGGLE */}
        <Section title="5. Selection Controls (Checkbox & Switch)">
          <Text className="text-xs font-medium text-gray-500 mb-1">Checkbox</Text>
          <Checkbox
            label="Interactive Checkbox option"
            checked={checkboxVal}
            onChange={setCheckboxVal}
          />
          <Checkbox label="Disabled Checkbox" checked={false} onChange={() => {}} disabled />

          <Text className="text-xs font-medium text-gray-500 mt-3 mb-1">Toggle Switch</Text>
          <Toggle
            label="Enable Notifications"
            value={toggleVal}
            onChange={setToggleVal}
          />
          <Toggle
            label="Disabled Switch"
            value={false}
            onChange={() => {}}
            disabled
          />
        </Section>

        {/* 6. RADIO GROUP */}
        <Section title="6. Radio Group">
          <Text className="text-xs font-medium text-gray-500 mb-1">Select Payment Mode</Text>
          <RadioGroup
            direction="row"
            options={[
              { label: 'UPI / Online', value: 'upi' },
              { label: 'Cash', value: 'cash' },
              { label: 'Card', value: 'card' },
            ]}
            value={radioVal}
            onChange={(val) => setRadioVal(val as 'upi' | 'cash' | 'card')}
          />
        </Section>

        {/* 7. DROPDOWN */}
        <Section title="7. Modal Dropdown Select">
          <Dropdown
            label="Select Garment Type"
            value={dropdownVal}
            onChange={(val) => setDropdownVal(val)}
            options={[
              { label: 'Shirt / Kurta', value: 'shirt' },
              { label: 'Pant / Trouser', value: 'pant' },
              { label: 'Suit / Blazer', value: 'suit' },
              { label: 'Sherwani', value: 'sherwani' },
              { label: 'Lehenga / Dress', value: 'dress' },
            ]}
          />
        </Section>

        {/* 8. AVATARS */}
        <Section title="8. Avatars">
          <Text className="text-xs font-medium text-gray-500 mb-1">Initials Fallback (sm, md, lg)</Text>
          <View className="flex-row items-center gap-4">
            <Avatar name="Harsh Parmar" size="sm" />
            <Avatar name="Rahul Sharma" size="md" />
            <Avatar name="MeasuresOne" size="lg" />
          </View>
        </Section>

        {/* 9. DATE & IMAGE PICKERS */}
        <Section title="9. Date & Image Pickers">
          <DatePickerField
            label="Delivery Date Picker"
            value={dateVal}
            onChange={setDateVal}
          />
          <ImagePickerField
            label="Cloth / Pattern Sample Photo"
            uri={imageUri}
            onChange={setImageUri}
          />
        </Section>

        {/* 10. LOADING SPINNERS */}
        <Section title="10. Loading Indicators">
          <LoadingSpinner text="Loading order details..." />
        </Section>

        {/* 11. EMPTY STATE */}
        <Section title="11. Empty State (Compact Variant)">
          <EmptyState
            variant="compact"
            icon="clipboard-list"
            title="No Pending Orders"
            description="All orders for today have been completed."
            actionLabel="Create Order"
            onAction={() => showToast('Create Order Action Tapped', 'info')}
          />
        </Section>

        {/* 12. TOAST NOTIFICATIONS */}
        <Section title="12. Toast Notifications">
          <Button
            title="Show Success Toast"
            variant="primary"
            onPress={() => showToast('Order saved successfully!', 'success')}
          />
          <Button
            title="Show Error Toast"
            variant="danger"
            onPress={() => showToast('Failed to connect to server', 'error')}
          />
          <Button
            title="Show Info Toast"
            variant="secondary"
            onPress={() => showToast('New update available', 'info')}
          />
        </Section>

        {/* 13. MODALS */}
        <Section title="13. Modals & Dialogs">
          <Button
            title="Open BottomSheet Modal"
            variant="outline"
            onPress={() => setBottomSheetVisible(true)}
          />
          <Button
            title="Open Center Alert Modal"
            variant="secondary"
            onPress={() => setCenterModalVisible(true)}
          />
        </Section>

        {/* BOTTOM SHEET DEMO */}
        <BottomSheet
          visible={bottomSheetVisible}
          onClose={() => setBottomSheetVisible(false)}
          title="Sample BottomSheet"
        >
          <View className="py-4">
            <Text className="font-sans text-base text-gray-700 mb-4">
              This is a bottom-sheet modal slide up. Great for filtering options, action sheets, or detailed forms.
            </Text>
            <Button title="Close Modal" onPress={() => setBottomSheetVisible(false)} />
          </View>
        </BottomSheet>

        {/* CENTER MODAL DEMO */}
        <CenterModal
          visible={centerModalVisible}
          onClose={() => setCenterModalVisible(false)}
          title="Confirm Action"
        >
          <View className="py-2">
            <Text className="font-sans text-sm text-gray-600 mb-4">
              Are you sure you want to proceed with this demo operation?
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setCenterModalVisible(false)}
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Confirm"
                  variant="primary"
                  onPress={() => {
                    setCenterModalVisible(false);
                    showToast('Action confirmed!', 'success');
                  }}
                />
              </View>
            </View>
          </View>
        </CenterModal>
      </ScrollView>
    </View>
  );
}
