// React's numeric style convention also applies to runtime CSS variables.
const unitless = new Set(["animationIterationCount","aspectRatio","borderImageOutset","borderImageSlice","borderImageWidth","boxFlex","boxFlexGroup","boxOrdinalGroup","columnCount","columns","flex","flexGrow","flexPositive","flexShrink","flexNegative","flexOrder","gridArea","gridRow","gridRowEnd","gridRowSpan","gridRowStart","gridColumn","gridColumnEnd","gridColumnSpan","gridColumnStart","fontWeight","lineClamp","lineHeight","opacity","order","orphans","scale","tabSize","widows","zIndex","zoom","fillOpacity","floodOpacity","stopOpacity","strokeDasharray","strokeDashoffset","strokeMiterlimit","strokeOpacity","strokeWidth"]);
export function cssValue(value, property) {
  if (value == null || typeof value === 'boolean' || value === '') return undefined;
  return typeof value === 'number' && value !== 0 && !unitless.has(property) && !property.startsWith('--') ? value + 'px' : String(value).trim();
}
