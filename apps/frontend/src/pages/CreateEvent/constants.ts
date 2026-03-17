import { CreateEventDto } from '@event-mgmt/shared-schemas';
export const initialFormData: Readonly<CreateEventDto> = {
  title: '',
  description: '',
  location: '',
  startDate: new Date(),
  endDate:  new Date(),
  capacity: 100,
  ticketPrice: 0,
  currency: 'THB',
  imageUrl: '',
}