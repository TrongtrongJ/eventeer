import { RegisterDto } from '@event-mgmt/shared-schemas';

export const initialFormData: Readonly<RegisterDto> = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
}