import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClassroomRow = {
  id: string;
  name: string;
  year_level: string | null;
  join_code: string;
  member_count: number;
};

// List classrooms owned by the signed-in teacher with member counts.
export const listClassrooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("classrooms")
      .select("id, name, year_level, join_code, classroom_children(count)")
      .eq("teacher_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      year_level: c.year_level,
      join_code: c.join_code,
      member_count: c.classroom_children?.[0]?.count ?? 0,
    })) as ClassroomRow[];
  });

// Create a classroom for the signed-in teacher.
export const createClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1).max(60), yearLevel: z.string().max(30).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("classrooms").insert({
      teacher_id: context.userId,
      name: data.name,
      year_level: data.yearLevel || null,
    });
    if (error) throw error;
    return { ok: true };
  });

// Ensure the signed-in user has the teacher role.
export const ensureTeacherRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "teacher" }, { onConflict: "user_id,role" });
    if (error) throw error;
    return { ok: true };
  });
