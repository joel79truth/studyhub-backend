import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  "https://qosudbigoxwzbdqkdecz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvc3VkYmlnb3h3emJkcWtkZWN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc0NTc0MywiZXhwIjoyMDczMzIxNzQzfQ.MGY3PdAKlF-j8Tnp_ttCnduiLFesCTPlFpFKD0jgEZQ"
);

const file = fs.readFileSync("test.txt");
const { data, error } = await supabase.storage
  .from("files")
  .upload("test-folder/test.txt", file, { contentType: "text/plain" });

console.log({ data, error });
