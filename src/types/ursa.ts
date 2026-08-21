import { Course } from './schedule';

export type UrsaProgram = 'regular' | 'buic';

export interface UrsaLoginCredentials {
  username: string;
  password: string;
  program?: UrsaProgram;
}

export interface UrsaSession {
  cookie: string;
  createdAt: number;
}

export interface UrsaLoginResponse {
  ok: boolean;
  connected?: boolean;
  error?: string;
}

export interface UrsaAuthStatusResponse {
  connected: boolean;
}

export interface UrsaLogoutResponse {
  ok: boolean;
  connected: boolean;
}

export interface UrsaProfile {
  studentId: string;
  studentName: string;
  faculty?: string;
  department?: string;
}

export interface UrsaProfileResponse {
  ok: boolean;
  studentId?: string;
  studentName?: string;
  meta?: string;
  faculty?: string;
  department?: string;
  html?: string;
  error?: string;
}

export interface UrsaFormControlOption {
  value: string;
  text: string;
}

export interface UrsaFormControl {
  name: string;
  type: string;
  value?: string;
  options?: UrsaFormControlOption[];
}

export interface UrsaForm {
  action: string;
  method: string;
  controls: UrsaFormControl[];
}

export interface UrsaSectionsResponse {
  ok: boolean;
  form?: UrsaForm;
  html?: string;
  error?: string;
}

export interface UrsaQueryRequest {
  academicYear?: string;
  semester?: string;
  courseCodes?: string[];
  option1?: string;
  action?: string;
  method?: string;
  fields?: Record<string, string>;
}

export interface UrsaQueryResponse {
  ok: boolean;
  courses?: Course[];
  html?: string;
  error?: string;
}
