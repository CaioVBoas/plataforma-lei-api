export interface OrganizationRefDto {
  id: string;
  name: string;
  type: string;
  logo?: string;
}

export interface OrganizationHistoryEntryDto {
  title: string;
  semester: string;
  disciplineName: string;
  teacherName: string;
  result: string;
}

export interface OrganizationDto extends OrganizationRefDto {
  location: string;
  about: string;
  audience: string;
  site: string;
  meetingCadence: string;
  onSiteVisit: string;
  history: OrganizationHistoryEntryDto[];
  cover?: string;
}

export type ScopeFitDto = 'fits' | 'needs-cut';
export type CourseLevelDto = 'intro' | 'intermediate' | 'advanced';
export type DemandConstraintDto = 'on-site' | 'sensitive-data' | 'confidential';

export interface QuestionReplyDto {
  id: string;
  text: string;
  at: string;
  time: string;
  by: string;
}

export interface DemandQuestionDto {
  id: string;
  teacherName: string;
  mine: boolean;
  askedAt: string;
  askedTime: string;
  text: string;
  replies: QuestionReplyDto[];
}

export interface DemandInvitationDto {
  to: string;
  from: string;
  message: string;
  sentAt: string;
}

export type DemandStatusDto = 'open' | 'reserved' | 'in-project';

export interface ReservationDto {
  teacherName: string;
  mine: boolean;
  until: string;
}

export interface ReferenceDto {
  name: string;
  description: string;
  url: string;
}

export interface DemandDto {
  id: string;
  organization: OrganizationRefDto;
  title: string;
  problem: string;
  description: string;
  affectedPublic: string;
  skills: string[];
  level: CourseLevelDto;
  constraints: DemandConstraintDto[];
  scopeFit: ScopeFitDto;
  scopeNote: string;
  meetingCadence: string;
  offers: string[];
  publishedAt: string;
  status: DemandStatusDto;
  reservation?: ReservationDto;
  watching: boolean;
  references: ReferenceDto[];
  questions: DemandQuestionDto[];
  invitation?: DemandInvitationDto;
}

export interface DemandDetailDto {
  demand: DemandDto;
  organization: OrganizationDto;
  projectId?: string;
}
