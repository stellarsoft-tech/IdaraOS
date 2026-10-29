/**
 * Security Training Schema - Drizzle ORM table definitions
 * Implements security awareness courses:
 * - Courses with a short video and a multiple-choice quiz
 * - Per-course minimum passing score
 * - Admin-assigned courses per user
 * - Attempt history with scores (retake required when below the passing score)
 */

import { pgTable, uuid, text, timestamp, index, date, integer, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"
import type { TrainingLesson } from "../../security/training-lesson"

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Course status values
 * Only published courses can be assigned or taken
 */
export const trainingCourseStatusValues = ["draft", "published", "archived"] as const
export type TrainingCourseStatus = (typeof trainingCourseStatusValues)[number]

/**
 * Course category values
 */
export const trainingCourseCategoryValues = [
  "phishing",
  "passwords",
  "social_engineering",
  "data_protection",
  "device_security",
  "incident_reporting",
  "general",
] as const
export type TrainingCourseCategory = (typeof trainingCourseCategoryValues)[number]

/**
 * Assignment status values
 * - not_started: assigned, video not watched yet
 * - in_progress: video watched, quiz not passed yet
 * - passed: latest attempt met the passing score
 * - retake_required: latest attempt was below the passing score
 */
export const trainingAssignmentStatusValues = ["not_started", "in_progress", "passed", "retake_required"] as const
export type TrainingAssignmentStatus = (typeof trainingAssignmentStatusValues)[number]

// ============================================================================
// COURSES
// ============================================================================

/**
 * Security training courses
 */
export const trainingCourses = pgTable(
  "security_training_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),

    // Stable key for starter-library courses (null for custom courses)
    libraryKey: text("library_key"),

    title: text("title").notNull(),
    description: text("description"),
    category: text("category", { enum: trainingCourseCategoryValues }).notNull().default("general"),

    // Narrated animated lesson (preferred) - see lib/security/training-lesson.ts
    lesson: jsonb("lesson").$type<TrainingLesson>(),

    // External video (YouTube, Vimeo, or a direct video file URL), used when there is no lesson
    videoUrl: text("video_url"),
    // Lesson or video length; computed automatically for lessons
    videoDurationMinutes: integer("video_duration_minutes"),

    // Minimum score (percentage, 0-100) required to pass
    passingScore: integer("passing_score").notNull().default(70),

    status: text("status", { enum: trainingCourseStatusValues }).notNull().default("draft"),

    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_training_courses_org").on(table.orgId),
    index("idx_security_training_courses_status").on(table.status),
    uniqueIndex("idx_security_training_courses_library_key").on(table.orgId, table.libraryKey),
  ]
)

// ============================================================================
// QUESTIONS
// ============================================================================

/**
 * Multiple-choice quiz questions for a course
 */
export const trainingQuestions = pgTable(
  "security_training_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => trainingCourses.id, { onDelete: "cascade" }),

    question: text("question").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOptionIndex: integer("correct_option_index").notNull(),
    explanation: text("explanation"),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_training_questions_course").on(table.courseId),
  ]
)

// ============================================================================
// ASSIGNMENTS
// ============================================================================

/**
 * Course assignments - one per user per course, created by an admin
 */
export const trainingAssignments = pgTable(
  "security_training_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => trainingCourses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    status: text("status", { enum: trainingAssignmentStatusValues }).notNull().default("not_started"),
    dueDate: date("due_date"),

    // Progress
    videoCompletedAt: timestamp("video_completed_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastScore: integer("last_score"),
    bestScore: integer("best_score"),
    passedAt: timestamp("passed_at", { withTimezone: true }),

    assignedById: uuid("assigned_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_training_assignments_org").on(table.orgId),
    index("idx_security_training_assignments_user").on(table.userId),
    index("idx_security_training_assignments_status").on(table.status),
    uniqueIndex("idx_security_training_assignments_course_user").on(table.courseId, table.userId),
  ]
)

// ============================================================================
// ATTEMPTS
// ============================================================================

/**
 * Quiz attempts - full history, one row per submission
 */
export const trainingAttempts = pgTable(
  "security_training_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id").notNull().references(() => trainingAssignments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    score: integer("score").notNull(), // percentage 0-100
    correctCount: integer("correct_count").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    passingScore: integer("passing_score").notNull(), // passing score at the time of the attempt
    passed: boolean("passed").notNull(),
    answers: jsonb("answers").$type<{
      questionId: string
      selectedOptionIndex: number | null
      correct: boolean
    }[]>().notNull(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_training_attempts_assignment").on(table.assignmentId),
    index("idx_security_training_attempts_user").on(table.userId),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const trainingCoursesRelations = relations(trainingCourses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [trainingCourses.orgId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [trainingCourses.createdById],
    references: [users.id],
  }),
  questions: many(trainingQuestions),
  assignments: many(trainingAssignments),
}))

export const trainingQuestionsRelations = relations(trainingQuestions, ({ one }) => ({
  course: one(trainingCourses, {
    fields: [trainingQuestions.courseId],
    references: [trainingCourses.id],
  }),
}))

export const trainingAssignmentsRelations = relations(trainingAssignments, ({ one, many }) => ({
  course: one(trainingCourses, {
    fields: [trainingAssignments.courseId],
    references: [trainingCourses.id],
  }),
  user: one(users, {
    fields: [trainingAssignments.userId],
    references: [users.id],
  }),
  assignedBy: one(users, {
    fields: [trainingAssignments.assignedById],
    references: [users.id],
  }),
  attempts: many(trainingAttempts),
}))

export const trainingAttemptsRelations = relations(trainingAttempts, ({ one }) => ({
  assignment: one(trainingAssignments, {
    fields: [trainingAttempts.assignmentId],
    references: [trainingAssignments.id],
  }),
  user: one(users, {
    fields: [trainingAttempts.userId],
    references: [users.id],
  }),
}))

// ============================================================================
// TYPES
// ============================================================================

export type TrainingCourse = typeof trainingCourses.$inferSelect
export type NewTrainingCourse = typeof trainingCourses.$inferInsert
export type TrainingQuestion = typeof trainingQuestions.$inferSelect
export type NewTrainingQuestion = typeof trainingQuestions.$inferInsert
export type TrainingAssignment = typeof trainingAssignments.$inferSelect
export type NewTrainingAssignment = typeof trainingAssignments.$inferInsert
export type TrainingAttempt = typeof trainingAttempts.$inferSelect
export type NewTrainingAttempt = typeof trainingAttempts.$inferInsert
