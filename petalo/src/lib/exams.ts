import type { Exam } from '../db/types';

export function examStats(exams: Exam[], scale = 110) {
  const passed = exams.filter((e) => e.status === 'superato');
  const graded = passed.filter((e) => e.grade >= 18);
  const val = (g: number) => (g === 31 ? 30 : g);
  const cfu = passed.reduce((s, e) => s + e.cfu, 0);
  const gradedCfu = graded.reduce((s, e) => s + e.cfu, 0);
  const weighted = gradedCfu ? graded.reduce((s, e) => s + val(e.grade) * e.cfu, 0) / gradedCfu : 0;
  const arithmetic = graded.length ? graded.reduce((s, e) => s + val(e.grade), 0) / graded.length : 0;
  return {
    passed: passed.length, todo: exams.length - passed.length, cfu, weighted, arithmetic,
    base: weighted ? (weighted * scale) / 30 : 0, lodi: graded.filter((e) => e.grade === 31).length,
  };
}
