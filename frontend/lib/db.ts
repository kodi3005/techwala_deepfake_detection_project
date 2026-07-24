import { createClient } from "./supabase";

export async function saveDetectionResult(result: any, mediaType: "image" | "video") {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  const payload = {
    user_id: user ? user.id : null,
    filename: result.filename,
    media_type: mediaType,
    verdict: result.verdict,
    risk_level: result.risk_level,
    overall_fake: result.overall_fake,
    overall_real: result.overall_real,
    details: result,
  };

  const { data, error } = await supabase
    .from("detections")
    .insert([payload])
    .select();

  if (error) {
    console.error("Error saving detection result to Supabase:", error.message);
  }
  
  return data;
}
