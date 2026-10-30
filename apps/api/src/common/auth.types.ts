import { Role } from '@buildpro/shared';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: Role;
}
