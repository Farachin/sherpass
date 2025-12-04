"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const data = Object.fromEntries(formData);
  
  const email = (data.email as string)?.trim();
  const password = data.password as string;

  // Validierung
  if (!email || !password) {
    return redirect("/login?error=login_failed");
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("LOGIN ERROR:", error.message);
    return redirect("/login?error=login_failed");
  }

  // Erfolgreich eingeloggt
  if (authData?.user) {
    revalidatePath("/", "layout");
    redirect("/");
  } else {
    return redirect("/login?error=login_failed");
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const data = Object.fromEntries(formData);

  const email = (data.email as string)?.trim();
  const password = data.password as string;

  // Validierung
  if (!email || !password || password.length < 6) {
    return redirect("/login?error=signup_failed");
  }

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    console.error("SIGNUP ERROR:", error.message);
    return redirect("/login?error=signup_failed");
  }

  // Erfolgreich registriert
  if (authData?.user) {
    revalidatePath("/", "layout");
    redirect("/");
  } else {
    return redirect("/login?error=signup_failed");
  }
}
