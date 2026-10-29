/**
 * Security Training API Client
 * React Query hooks for training courses (admin) and My Training (employees)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  TrainingAssignmentStatus,
  TrainingCourseCategory,
  TrainingCourseStatus,
} from "@/lib/db/schema/security-training"
import type { TrainingLesson } from "@/lib/security/training-lesson"

// ============================================================================
// TYPES
// ============================================================================

export interface TrainingCourse {
  id: string
  orgId: string
  libraryKey: string | null
  title: string
  description: string | null
  category: TrainingCourseCategory
  lesson: TrainingLesson | null
  videoUrl: string | null
  videoDurationMinutes: number | null
  passingScore: number
  status: TrainingCourseStatus
  createdAt: string
  updatedAt: string
}

export interface TrainingCourseListItem extends TrainingCourse {
  questionCount: number
  assignedCount: number
  passedCount: number
  retakeRequiredCount: number
  averageScore: number | null
}

export interface TrainingQuestion {
  id: string
  question: string
  options: string[]
  correctOptionIndex: number
  explanation: string | null
  sortOrder: number
}

export interface TrainingCourseDetail extends TrainingCourse {
  questions: TrainingQuestion[]
}

export interface TrainingQuestionInput {
  question: string
  options: string[]
  correctOptionIndex: number
  explanation?: string | null
}

export interface TrainingAssignment {
  id: string
  courseId: string
  userId: string
  userName: string
  userEmail: string
  status: TrainingAssignmentStatus
  dueDate: string | null
  videoCompletedAt: string | null
  attemptCount: number
  lastScore: number | null
  bestScore: number | null
  passedAt: string | null
  createdAt: string
  isOverdue: boolean
}

export interface AssignableUser {
  id: string
  name: string
  email: string
  status: string
}

export interface TrainingLibraryItem {
  key: string
  title: string
  description: string
  category: TrainingCourseCategory
  questionCount: number
  installed: boolean
}

export interface MyTrainingItem {
  id: string
  status: TrainingAssignmentStatus
  dueDate: string | null
  attemptCount: number
  lastScore: number | null
  bestScore: number | null
  passedAt: string | null
  videoCompletedAt: string | null
  assignedAt: string
  isOverdue: boolean
  course: {
    id: string
    title: string
    description: string | null
    category: TrainingCourseCategory
    videoDurationMinutes: number | null
    passingScore: number
  }
}

export interface MyTrainingStats {
  total: number
  passed: number
  outstanding: number
  retakeRequired: number
  overdue: number
}

export interface AttemptReviewItem {
  questionId: string
  question: string
  options: string[]
  selectedOptionIndex: number | null
  correct: boolean
  correctOptionIndex?: number
  explanation?: string | null
}

export interface AttemptReview {
  id: string
  score: number
  correctCount: number
  totalQuestions: number
  passingScore: number
  passed: boolean
  submittedAt: string
  items: AttemptReviewItem[]
}

export interface MyTrainingCourse {
  id: string
  status: TrainingAssignmentStatus
  dueDate: string | null
  isOverdue: boolean
  attemptCount: number
  lastScore: number | null
  bestScore: number | null
  passedAt: string | null
  videoCompletedAt: string | null
  quizUnlocked: boolean
  course: {
    id: string
    title: string
    description: string | null
    category: TrainingCourseCategory
    lesson: TrainingLesson | null
    videoUrl: string | null
    videoDurationMinutes: number | null
    passingScore: number
    questionCount: number
  }
  questions: { id: string; question: string; options: string[] }[]
  attempts: {
    id: string
    score: number
    correctCount: number
    totalQuestions: number
    passed: boolean
    submittedAt: string
  }[]
  lastAttemptReview: AttemptReview | null
}

// ============================================================================
// HELPERS
// ============================================================================

async function request<T>(url: string, init?: RequestInit, fallbackError = "Request failed"): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || fallbackError)
  }
  return res.json()
}

const keys = {
  courses: ["security-training-courses"] as const,
  course: (id: string) => ["security-training-course", id] as const,
  assignments: (courseId: string) => ["security-training-assignments", courseId] as const,
  assignableUsers: ["security-training-assignable-users"] as const,
  library: ["security-training-library"] as const,
  myTraining: ["my-training"] as const,
  myTrainingCourse: (id: string) => ["my-training", id] as const,
}

// ============================================================================
// ADMIN - COURSES
// ============================================================================

export function useTrainingCourses() {
  return useQuery({
    queryKey: keys.courses,
    queryFn: () => request<{ data: TrainingCourseListItem[] }>(
      "/api/security/training/courses", undefined, "Failed to fetch courses"
    ),
  })
}

export function useTrainingCourse(id: string | undefined) {
  return useQuery({
    queryKey: keys.course(id ?? ""),
    queryFn: () => request<{ data: TrainingCourseDetail }>(
      `/api/security/training/courses/${id}`, { cache: "no-store" }, "Failed to fetch course"
    ),
    enabled: !!id,
  })
}

export function useCreateTrainingCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<TrainingCourse>) =>
      request<{ data: TrainingCourse }>("/api/security/training/courses", {
        method: "POST",
        body: JSON.stringify(data),
      }, "Failed to create course"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.courses })
    },
  })
}

export function useUpdateTrainingCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TrainingCourse> }) =>
      request<{ data: TrainingCourse }>(`/api/security/training/courses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }, "Failed to update course"),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.courses })
      queryClient.invalidateQueries({ queryKey: keys.course(variables.id) })
      queryClient.invalidateQueries({ queryKey: keys.myTraining })
    },
  })
}

export function useDeleteTrainingCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: boolean }>(`/api/security/training/courses/${id}`, {
        method: "DELETE",
      }, "Failed to delete course"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.courses })
      queryClient.invalidateQueries({ queryKey: keys.library })
      queryClient.invalidateQueries({ queryKey: keys.myTraining })
    },
  })
}

export function useReplaceTrainingQuestions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, questions }: { courseId: string; questions: TrainingQuestionInput[] }) =>
      request<{ data: TrainingQuestion[] }>(`/api/security/training/courses/${courseId}/questions`, {
        method: "PUT",
        body: JSON.stringify({ questions }),
      }, "Failed to save questions"),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.courses })
      queryClient.invalidateQueries({ queryKey: keys.course(variables.courseId) })
    },
  })
}

// ============================================================================
// ADMIN - LIBRARY
// ============================================================================

export function useTrainingLibrary() {
  return useQuery({
    queryKey: keys.library,
    queryFn: () => request<{ data: TrainingLibraryItem[] }>(
      "/api/security/training/library", undefined, "Failed to fetch starter courses"
    ),
  })
}

export function useInstallTrainingLibrary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (libraryKeys?: string[]) =>
      request<{ data: { installed: { id: string; title: string }[]; skipped: string[] } }>(
        "/api/security/training/library",
        { method: "POST", body: JSON.stringify({ keys: libraryKeys }) },
        "Failed to install starter courses"
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.courses })
      queryClient.invalidateQueries({ queryKey: keys.library })
    },
  })
}

// ============================================================================
// ADMIN - ASSIGNMENTS
// ============================================================================

export function useTrainingAssignments(courseId: string | undefined) {
  return useQuery({
    queryKey: keys.assignments(courseId ?? ""),
    queryFn: () => request<{ data: TrainingAssignment[] }>(
      `/api/security/training/courses/${courseId}/assignments`, { cache: "no-store" }, "Failed to fetch assignments"
    ),
    enabled: !!courseId,
  })
}

export function useAssignableTrainingUsers(enabled = true) {
  return useQuery({
    queryKey: keys.assignableUsers,
    queryFn: () => request<{ data: AssignableUser[] }>(
      "/api/security/training/assignable-users", undefined, "Failed to fetch users"
    ),
    enabled,
  })
}

export function useAssignTrainingCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, ...data }: {
      courseId: string
      userIds?: string[]
      allUsers?: boolean
      dueDate?: string | null
    }) =>
      request<{ data: { assigned: number; alreadyAssigned: number } }>(
        `/api/security/training/courses/${courseId}/assignments`,
        { method: "POST", body: JSON.stringify(data) },
        "Failed to assign course"
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.assignments(variables.courseId) })
      queryClient.invalidateQueries({ queryKey: keys.courses })
      queryClient.invalidateQueries({ queryKey: keys.myTraining })
    },
  })
}

export function useUpdateTrainingAssignment(courseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; dueDate?: string | null; reset?: boolean }) =>
      request(`/api/security/training/assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }, "Failed to update assignment"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.assignments(courseId) })
      queryClient.invalidateQueries({ queryKey: keys.courses })
      queryClient.invalidateQueries({ queryKey: keys.myTraining })
    },
  })
}

export function useDeleteTrainingAssignment(courseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/security/training/assignments/${id}`, { method: "DELETE" }, "Failed to remove assignment"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.assignments(courseId) })
      queryClient.invalidateQueries({ queryKey: keys.courses })
      queryClient.invalidateQueries({ queryKey: keys.myTraining })
    },
  })
}

// ============================================================================
// EMPLOYEE - MY TRAINING
// ============================================================================

export function useMyTraining() {
  return useQuery({
    queryKey: keys.myTraining,
    queryFn: () => request<{ data: MyTrainingItem[]; stats: MyTrainingStats }>(
      "/api/security/my-training", { cache: "no-store" }, "Failed to fetch your training"
    ),
  })
}

export function useMyTrainingCourse(id: string | undefined) {
  return useQuery({
    queryKey: keys.myTrainingCourse(id ?? ""),
    queryFn: () => request<{ data: MyTrainingCourse }>(
      `/api/security/my-training/${id}`, { cache: "no-store" }, "Failed to fetch course"
    ),
    enabled: !!id,
  })
}

export function useCompleteTrainingVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/security/my-training/${id}/video-complete`, { method: "POST" }, "Failed to save progress"),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: keys.myTrainingCourse(id) })
      queryClient.invalidateQueries({ queryKey: keys.myTraining })
    },
  })
}

export function useSubmitTrainingAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: Record<string, number> }) =>
      request<{ data: AttemptReview }>(`/api/security/my-training/${id}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }, "Failed to submit quiz"),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: keys.myTrainingCourse(variables.id) })
      queryClient.invalidateQueries({ queryKey: keys.myTraining })
    },
  })
}
