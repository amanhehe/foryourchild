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

export type ChildClassroomRow = {
  child_id: string;
  classroom_id: string;
  name: string;
  year_level: string | null;
  join_code: string;
};

const joinCodeSchema = z
  .string()
  .trim()
  .min(3, "Enter the class code from the teacher.")
  .max(12, "Class code is too long.")
  .regex(/^[a-zA-Z0-9-]+$/, "Class codes can only use letters, numbers, and dashes.")
  .transform((code) => code.toUpperCase());

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

// List classes each of the signed-in parent's children have joined.
export const listChildClassrooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: children, error: childError } = await context.supabase
      .from("children")
      .select("id")
      .eq("parent_id", context.userId);
    if (childError) throw childError;

    const childIds = (children ?? []).map((child) => child.id);
    if (childIds.length === 0) return [] as ChildClassroomRow[];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("classroom_children")
      .select("child_id, classroom_id, classrooms(id, name, year_level, join_code)")
      .in("child_id", childIds)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return (data ?? []).flatMap((row: any) => {
      const room = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms;
      if (!room) return [];
      return [
        {
          child_id: row.child_id,
          classroom_id: row.classroom_id,
          name: room.name,
          year_level: room.year_level,
          join_code: room.join_code,
        },
      ];
    }) as ChildClassroomRow[];
  });

// Allow a parent to connect one of their child profiles to a teacher's class code.
export const joinClassroom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ childId: z.string().uuid(), code: joinCodeSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: child, error: childError } = await context.supabase
      .from("children")
      .select("id")
      .eq("id", data.childId)
      .eq("parent_id", context.userId)
      .maybeSingle();
    if (childError) throw childError;
    if (!child) throw new Error("Choose one of your child profiles first.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error: roomError } = await supabaseAdmin
      .from("classrooms")
      .select("id, name, year_level, join_code")
      .eq("join_code", data.code)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) throw new Error("No class found with that code.");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("classroom_children")
      .select("id")
      .eq("child_id", data.childId)
      .eq("classroom_id", room.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (!existing) {
      const { error } = await supabaseAdmin.from("classroom_children").insert({
        child_id: data.childId,
        classroom_id: room.id,
      });
      if (error) throw error;
    }

    return {
      child_id: data.childId,
      classroom_id: room.id,
      name: room.name,
      year_level: room.year_level,
      join_code: room.join_code,
    } as ChildClassroomRow;
  });

// Ensure the signed-in user has the teacher role.
export const ensureTeacherRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "teacher" }, { onConflict: "user_id,role" });
    if (error) throw error;
    return { ok: true };
  });
