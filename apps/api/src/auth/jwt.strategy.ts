import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }
  validate(payload: { sub?: string; tenantId?: string; role?: AuthUser['role']; typ?: string }): AuthUser {
    // Token tanda tangan URL foto (typ: 'file') bukan token login; tolak agar tidak bisa dipakai memanggil API.
    if (payload.typ || !payload.sub || !payload.tenantId || !payload.role) {
      throw new UnauthorizedException('Token tidak valid');
    }
    return { userId: payload.sub, tenantId: payload.tenantId, role: payload.role };
  }
}
