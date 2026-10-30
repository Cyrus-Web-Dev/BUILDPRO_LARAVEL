import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, LoginDto, RegisterCompanyDto } from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private token(user: { id: string; tenantId: string; role: string }) {
    return this.jwt.sign({ sub: user.id, tenantId: user.tenantId, role: user.role });
  }

  private publicUser(u: { id: string; name: string; email: string; role: string; tenantId: string }) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, tenantId: u.tenantId };
  }

  async registerCompany(dto: RegisterCompanyDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email sudah terdaftar');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: dto.companyName } });
      return tx.user.create({
        data: { tenantId: tenant.id, name: dto.name, email: dto.email, passwordHash, role: 'OWNER' },
      });
    });
    return { accessToken: this.token(user), user: this.publicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email atau password salah');
    }
    return { accessToken: this.token(user), user: this.publicUser(user) };
  }

  async createUser(tenantId: string, dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email sudah terdaftar');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { tenantId, name: dto.name, email: dto.email, passwordHash, role: dto.role },
    });
    return this.publicUser(user);
  }

  async listUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    return users.map((u) => this.publicUser(u));
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.publicUser(user);
  }
}
