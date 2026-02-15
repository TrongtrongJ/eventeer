import type { ResetPasswordFormDto } from '@event-mgmt/shared-schemas';

export const initialFormData: Readonly<ResetPasswordFormDto> = {
  password: '',
  confirmPassword: '',
}