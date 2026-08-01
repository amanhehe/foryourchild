import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listChildren from "./tools/list-children";
import getChildProgress from "./tools/get-child-progress";
import listActivity from "./tools/list-activity";
import addChild from "./tools/add-child";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "remix-of-buddy-s-brilliant-bites",
  title: "Remix of Buddy's Brilliant Bites",
  version: "0.1.0",
  instructions:
    "Tools for AI Phonics Buddy, a reading coach for children aged 4-8. Use `list_children` to find the signed-in parent's children, `get_child_progress` for one child's reading stats and quizzes, `list_activity` for their recent learning events, and `add_child` to create a new child profile.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listChildren, getChildProgress, listActivity, addChild],
});
