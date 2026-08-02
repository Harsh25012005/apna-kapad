/** The standard tailoring fields, used both as a one-tap "add default fields"
 * shortcut on the shop-wide Custom Measurement Fields page and per garment
 * type on a single measurement form. */
export const DEFAULT_SHIRT_FIELDS = ['Chest', 'Shoulder', 'Sleeve', 'Shirt Length', 'Collar', 'Cuff'];
export const DEFAULT_PANT_FIELDS = ['Waist', 'Pant Length', 'Hip', 'Thigh', 'Knee', 'Bottom'];
export const DEFAULT_ALL_FIELDS = [...DEFAULT_SHIRT_FIELDS, ...DEFAULT_PANT_FIELDS];
