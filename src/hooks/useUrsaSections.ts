'use client';

import { useState, useCallback } from 'react';
import { Course } from '@/types/schedule';
import { UrsaForm, UrsaSectionsResponse, UrsaQueryRequest, UrsaQueryResponse } from '@/types/ursa';

export interface UseUrsaSectionsReturn {
  form: UrsaForm | null;
  courses: Course[];
  rawHtml: string;
  isLoading: boolean;
  error: string | null;
  fetchFormControls: () => Promise<UrsaForm | null>;
  searchSections: (params: UrsaQueryRequest) => Promise<Course[]>;
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  clearResults: () => void;
  clearError: () => void;
}

export function useUrsaSections(): UseUrsaSectionsReturn {
  const [form, setForm] = useState<UrsaForm | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rawHtml, setRawHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearResults = useCallback(() => {
    setCourses([]);
    setRawHtml('');
    setError(null);
  }, []);

  const fetchFormControls = useCallback(async (): Promise<UrsaForm | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/sections', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Connect URSA first');
        } else {
          setError('ไม่สามารถดึงข้อมูล Course Sections ได้');
        }
        setIsLoading(false);
        return null;
      }

      const data: UrsaSectionsResponse = await response.json();
      if (data.ok && data.form) {
        setForm(data.form);
        if (data.html) setRawHtml(data.html);
      }
      setIsLoading(false);
      return data.form || null;
    } catch {
      setError('ไม่สามารถดึงข้อมูล Course Sections ได้');
      setIsLoading(false);
      return null;
    }
  }, []);

  const searchSections = useCallback(
    async (params: UrsaQueryRequest): Promise<Course[]> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/sections/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        const data: UrsaQueryResponse = await response.json();

        if (!response.ok || !data.ok) {
          const errMsg = data.error || 'ค้นหา Section ไม่สำเร็จ';
          setError(errMsg);
          setIsLoading(false);
          return [];
        }

        const foundCourses = data.courses || [];
        setCourses(foundCourses);
        if (data.html) setRawHtml(data.html);
        setIsLoading(false);
        return foundCourses;
      } catch (err: any) {
        const errMsg = err?.message || 'ค้นหา Section ไม่สำเร็จ';
        setError(errMsg);
        setIsLoading(false);
        return [];
      }
    },
    []
  );

  return {
    form,
    courses,
    rawHtml,
    isLoading,
    error,
    fetchFormControls,
    searchSections,
    setCourses,
    clearResults,
    clearError,
  };
}
