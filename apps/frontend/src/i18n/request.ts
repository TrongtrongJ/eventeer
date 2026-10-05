import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const store = await cookies();

  const locale = store.get('locale')?.value || 'en';
  return {
    locale,
    // Dynamically import the correct JSON file based on the locale URL parameter
    messages: (await import(`./messages/${locale}.json`)).default
  };
});