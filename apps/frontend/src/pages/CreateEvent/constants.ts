import { CreateEventDto } from '@event-mgmt/shared-schemas';
export const initialFormData: Readonly<CreateEventDto> = {
  title: '',
  description: '',
  location: '',
  startDate: '',
  endDate: '',
  capacity: 100,
  ticketPrice: 0,
  currency: 'USD',
  imageUrl: '',
}