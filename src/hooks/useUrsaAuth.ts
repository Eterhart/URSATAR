'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UrsaLoginCredentials,
  UrsaLoginResponse,
  UrsaAuthStatusResponse,
  UrsaProfileResponse,
} from '@/types/ursa';

export interface UseUrsaAuthReturn {
  connected: boolean;
  studentId: string;
  studentName: string;
  meta: string;
  faculty: string;
  department: string;
  isLoading: boolean;
  error: string | null;
  checkStatus: () => Promise<boolean>;
  fetchProfile: () => Promise<UrsaProfileResponse | null>;
  login: (credentials: UrsaLoginCredentials) => Promise<boolean>;
  logout: () => Promise<boolean>;
  clearError: () => void;
}

export function useUrsaAuth(): UseUrsaAuthReturn {
  const [connected, setConnected] = useState<boolean>(false);
  const [studentId, setStudentId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [meta, setMeta] = useState<string>('');
  const [faculty, setFaculty] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchProfile = useCallback(async (): Promise<UrsaProfileResponse | null> => {
    try {
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.status === 401) {
        setConnected(false);
        setStudentId('');
        setStudentName('');
        setMeta('');
        setFaculty('');
        setDepartment('');
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data: UrsaProfileResponse = await response.json();
      if (data.ok) {
        if (data.studentId) setStudentId(data.studentId);
        if (data.studentName) setStudentName(data.studentName);
        if (data.meta) setMeta(data.meta);
        else if (data.studentId) setMeta(`Student ID ${data.studentId}`);
        if (data.faculty) setFaculty(data.faculty);
        if (data.department) setDepartment(data.department);
      }
      return data;
    } catch {
      // Non-blocking fallback
      return null;
    }
  }, []);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/status', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        setConnected(false);
        setIsLoading(false);
        return false;
      }

      const data: UrsaAuthStatusResponse = await response.json();
      const isConnected = Boolean(data.connected);
      setConnected(isConnected);

      if (isConnected) {
        await fetchProfile();
      } else {
        setStudentId('');
        setStudentName('');
        setMeta('');
        setFaculty('');
        setDepartment('');
      }

      setIsLoading(false);
      return isConnected;
    } catch {
      setConnected(false);
      setIsLoading(false);
      return false;
    }
  }, [fetchProfile]);

  const login = useCallback(
    async (credentials: UrsaLoginCredentials): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        const data: UrsaLoginResponse = await response.json();

        if (!response.ok || !data.ok) {
          const errMsg = data.error || 'URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่';
          setError(errMsg);
          setIsLoading(false);
          return false;
        }

        setConnected(true);
        await fetchProfile();
        setIsLoading(false);
        return true;
      } catch (err: any) {
        const errMsg = err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        setError(errMsg);
        setIsLoading(false);
        return false;
      }
    },
    [fetchProfile]
  );

  const logout = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      setConnected(false);
      setStudentId('');
      setStudentName('');
      setMeta('');
      setFaculty('');
      setDepartment('');
      setError(null);
      setIsLoading(false);
      return true;
    } catch {
      setConnected(false);
      setIsLoading(false);
      return true;
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    connected,
    studentId,
    studentName,
    meta,
    faculty,
    department,
    isLoading,
    error,
    checkStatus,
    fetchProfile,
    login,
    logout,
    clearError,
  };
}
