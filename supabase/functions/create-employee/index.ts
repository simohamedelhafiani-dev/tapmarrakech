import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Authentification requise",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL manquant");
    }

    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY manquant");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
    }

    // Client avec la session de l'utilisateur connecté
    const supabaseUser = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Vérification de l'utilisateur connecté
    const {
      data: {
        user: caller,
      },
      error: callerError,
    } = await supabaseUser.auth.getUser();

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({
          error: "Session utilisateur invalide",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Vérification du rôle Admin TapMarrakech
    const {
      data: profile,
      error: profileError,
    } = await supabaseUser
      .from("profiles")
      .select("id, role, name, email")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Accès réservé à l'administrateur TapMarrakech",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const body = await req.json();

    const establishmentId = String(
      body.establishment_id ?? "",
    ).trim();

    const name = String(
      body.name ?? "",
    ).trim();

    const code = String(
      body.code ?? "",
    ).trim();

    if (!establishmentId) {
      return new Response(
        JSON.stringify({
          error: "Établissement obligatoire",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!name) {
      return new Response(
        JSON.stringify({
          error: "Nom de l'employé obligatoire",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (code.length < 4) {
      return new Response(
        JSON.stringify({
          error: "Le code employé doit contenir au moins 4 caractères",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Client Service Role
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Vérifier que l'établissement existe
    const {
      data: establishment,
      error: establishmentError,
    } = await supabaseAdmin
      .from("establishments")
      .select("id, name")
      .eq("id", establishmentId)
      .maybeSingle();

    if (establishmentError) {
      throw establishmentError;
    }

    if (!establishment) {
      return new Response(
        JSON.stringify({
          error: "Établissement introuvable",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * Compte technique Supabase Auth
     *
     * L'employé n'utilise jamais cet email ni ce mot de passe.
     * Ils servent uniquement à créer un utilisateur Auth technique
     * permettant d'attribuer correctement les opérations à l'employé.
     *
     * IMPORTANT :
     * bcrypt a une limite de longueur.
     * On utilise donc un UUID unique de 36 caractères.
     */
    const technicalId = crypto.randomUUID();

    const technicalEmail =
      `employee-${technicalId}@tapmarrakech.local`;

    const technicalPassword =
      crypto.randomUUID();

    // Création du compte Auth
    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.admin.createUser({
      email: technicalEmail,
      password: technicalPassword,
      email_confirm: true,
      user_metadata: {
        employee_name: name,
        establishment_id: establishmentId,
        account_type: "employee",
      },
    });

    if (authError || !authData.user) {
      throw authError ?? new Error(
        "Impossible de créer l'utilisateur",
      );
    }

    const employeeId = authData.user.id;

    try {
      // Création du profil
      const {
        error: profileInsertError,
      } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: employeeId,
          email: technicalEmail,
          name,
          role: "employee",
        });

      if (profileInsertError) {
        throw profileInsertError;
      }

      // Association à l'établissement
      const {
        error: staffError,
      } = await supabaseAdmin
        .from("establishment_staff")
        .insert({
          establishment_id: establishmentId,
          user_id: employeeId,
          role: "STAFF",
          active: true,
        });

      if (staffError) {
        throw staffError;
      }

      // Hash sécurisé du code employé
      const {
        data: hashedCode,
        error: hashError,
      } = await supabaseAdmin.rpc(
        "hash_employee_code",
        {
          p_code: code,
        },
      );

      if (hashError || !hashedCode) {
        throw hashError ?? new Error(
          "Impossible de sécuriser le code",
        );
      }

      // Création du code d'accès employé
      const {
        error: codeError,
      } = await supabaseAdmin
        .from("employee_access_codes")
        .insert({
          establishment_id: establishmentId,
          user_id: employeeId,
          code_hash: hashedCode,
          active: true,
        });

      if (codeError) {
        throw codeError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          employee_id: employeeId,
          employee_name: name,
          establishment_id: establishmentId,
          establishment_name: establishment.name,
          code,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    } catch (creationError) {
      // Nettoyage complet si une étape échoue
      await supabaseAdmin
        .from("employee_access_codes")
        .delete()
        .eq("user_id", employeeId);

      await supabaseAdmin
        .from("establishment_staff")
        .delete()
        .eq("user_id", employeeId);

      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", employeeId);

      await supabaseAdmin.auth.admin.deleteUser(
        employeeId,
      );

      throw creationError;
    }
  } catch (error) {
    console.error(
      "Erreur create-employee:",
      error,
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Erreur serveur",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});