import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { assignMemberSchema, CreateProjectDto, UpdateProjectDto, createProjectSchema, updateProjectSchema, updateProjectStatusSchema } from '@buildpro/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Roles('OWNER', 'ADMIN')
  @Post()
  create(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto) {
    return this.projects.create(u.tenantId, dto);
  }

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.projects.list(u);
  }

  @Get('overview')
  overview(@CurrentUser() u: AuthUser) {
    return this.projects.overview(u);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto) {
    return this.projects.update(u.tenantId, id, dto);
  }

  @Roles('OWNER')
  @Post(':id/rab/reopen')
  reopenRab(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.projects.reopenRab(u.tenantId, id);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.projects.get(u, id);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id/status')
  status(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema)) dto: { status: 'PLANNING' | 'ONGOING' | 'DONE' },
  ) {
    return this.projects.updateStatus(u.tenantId, id, dto.status);
  }

  @Roles('OWNER')
  @Post(':id/rab/approve')
  approveRab(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.projects.approveRab(u.tenantId, id);
  }

  @Roles('OWNER', 'ADMIN')
  @Get(':id/members')
  members(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.projects.listMembers(u.tenantId, id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/members')
  addMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(assignMemberSchema)) dto: { userId: string }) {
    return this.projects.addMember(u.tenantId, id, dto.userId);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id/members/:userId')
  removeMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.projects.removeMember(u.tenantId, id, userId);
  }
}
