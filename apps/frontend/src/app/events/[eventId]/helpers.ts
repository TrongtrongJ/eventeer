export function formatEventDate(dateString?: string) {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch(err) {
    console.error(err)
  }
  
};
export function formatPrice(price?: number) {
  if (!price) return '';
  return price.toFixed(2);
}