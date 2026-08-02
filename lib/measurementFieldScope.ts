/** A shop-defined measurement field is scoped 'Shirt' | 'Pant' | 'Both'
 * (measurement_field_definitions.garment_type) — this decides whether it
 * belongs on a form/conversation for the garment type currently selected
 * ('Shirt' | 'Pant' | 'Shirt+Pant', the measurements.garment_type values). */
export function fieldDefMatchesGarment(defGarmentType: string, selectedGarmentType: string): boolean {
  if (defGarmentType === 'Both') return true;
  if (selectedGarmentType === 'Shirt+Pant') return true;
  return defGarmentType === selectedGarmentType;
}
