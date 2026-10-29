import { withSupabase } from 'npm:@supabase/server@^1'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      if (req.method !== 'POST') {
        return Response.json(
          { error: 'Méthode non autorisée.' },
          { status: 405 }
        )
      }

      const { supabaseAdmin, userClaims } = ctx

      // --------------------------------------------------
      // 1. Vérifier l'utilisateur connecté
      // --------------------------------------------------

      const adminUserId = userClaims?.id

      if (!adminUserId) {
        console.error('Utilisateur non authentifié.')

        return Response.json(
          { error: 'Utilisateur non authentifié.' },
          { status: 401 }
        )
      }

      console.log('Étape 1 OK - utilisateur:', adminUserId)

      // --------------------------------------------------
      // 2. Vérifier que l'utilisateur est Admin TapMarrakech
      // --------------------------------------------------

      const { data: adminProfile, error: adminProfileError } =
        await supabaseAdmin
          .from('profiles')
          .select('id, email, name, role')
          .eq('id', adminUserId)
          .maybeSingle()

      if (adminProfileError) {
        console.error(
          'Erreur lecture profil admin:',
          adminProfileError
        )

        return Response.json(
          {
            error:
              'Impossible de vérifier le profil administrateur.',
            details: adminProfileError.message,
          },
          { status: 500 }
        )
      }

      if (!adminProfile) {
        console.error('Profil administrateur introuvable.')

        return Response.json(
          {
            error: 'Profil administrateur introuvable.',
          },
          { status: 403 }
        )
      }

      if (adminProfile.role !== 'admin') {
        console.error(
          'Utilisateur non admin:',
          adminProfile.role
        )

        return Response.json(
          {
            error:
              'Accès réservé à l’administrateur TapMarrakech.',
          },
          { status: 403 }
        )
      }

      console.log('Étape 2 OK - admin confirmé')

      // --------------------------------------------------
      // 3. Lire les données envoyées par le frontend
      // --------------------------------------------------

      const body = await req.json()

      const {
        establishment_id,
        email,
        password,
        name,
        role,
      } = body

      console.log('Étape 3 - données reçues:', {
        establishment_id,
        email,
        name,
        role,
      })

      // --------------------------------------------------
      // 4. Vérifications
      // --------------------------------------------------

      if (!establishment_id) {
        return Response.json(
          { error: 'Établissement obligatoire.' },
          { status: 400 }
        )
      }

      if (!email || !email.trim()) {
        return Response.json(
          { error: 'Email obligatoire.' },
          { status: 400 }
        )
      }

      if (!password || password.length < 6) {
        return Response.json(
          {
            error:
              'Le mot de passe doit contenir au moins 6 caractères.',
          },
          { status: 400 }
        )
      }

      if (!name || !name.trim()) {
        return Response.json(
          { error: 'Nom obligatoire.' },
          { status: 400 }
        )
      }

      if (role !== 'responsible' && role !== 'employee') {
        return Response.json(
          { error: 'Rôle invalide.' },
          { status: 400 }
        )
      }

      // --------------------------------------------------
      // 5. Vérifier l'établissement
      // --------------------------------------------------

      const { data: establishment, error: establishmentError } =
        await supabaseAdmin
          .from('establishments')
          .select('id, name, slug, user_id')
          .eq('id', establishment_id)
          .maybeSingle()

      if (establishmentError) {
        console.error(
          'Erreur établissement:',
          establishmentError
        )

        return Response.json(
          {
            error:
              'Erreur lors de la vérification de l’établissement.',
            details: establishmentError.message,
          },
          { status: 500 }
        )
      }

      if (!establishment) {
        return Response.json(
          {
            error: 'Établissement introuvable.',
          },
          { status: 404 }
        )
      }

      console.log(
        'Étape 4 OK - établissement:',
        establishment.name
      )

      // --------------------------------------------------
      // 6. Créer le compte Auth
      // --------------------------------------------------

      const normalizedEmail = email.trim().toLowerCase()

      console.log(
        'Étape 5 - création du compte Auth:',
        normalizedEmail
      )

      const {
        data: authData,
        error: authError,
      } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
        },
      })

      if (authError || !authData?.user) {
        console.error(
          'Erreur création Auth:',
          authError
        )

        return Response.json(
          {
            error:
              authError?.message ??
              'Impossible de créer le compte utilisateur.',
          },
          { status: 400 }
        )
      }

      const newUserId = authData.user.id

      console.log(
        'Étape 5 OK - compte Auth créé:',
        newUserId
      )

      // --------------------------------------------------
      // 7. Créer le profil
      // --------------------------------------------------

      console.log('Étape 6 - création du profil')

      const { error: profileError } =
        await supabaseAdmin
          .from('profiles')
          .insert({
            id: newUserId,
            email: normalizedEmail,
            name: name.trim(),
            role,
          })

      if (profileError) {
        console.error(
          'Erreur création profil:',
          profileError
        )

        await supabaseAdmin.auth.admin.deleteUser(
          newUserId
        )

        return Response.json(
          {
            error:
              'Impossible de créer le profil utilisateur.',
            details: profileError.message,
          },
          { status: 400 }
        )
      }

      console.log('Étape 6 OK - profil créé')

      // --------------------------------------------------
      // 8. Déterminer le rôle établissement
      // --------------------------------------------------

      const staffRole =
        role === 'responsible'
          ? 'MANAGER'
          : 'STAFF'

      // --------------------------------------------------
      // 9. Rattacher l'utilisateur à l'établissement
      // --------------------------------------------------

      console.log(
        'Étape 7 - rattachement établissement:',
        staffRole
      )

      const { error: staffError } =
        await supabaseAdmin
          .from('establishment_staff')
          .insert({
            establishment_id,
            user_id: newUserId,
            role: staffRole,
            active: true,
          })

      if (staffError) {
        console.error(
          'Erreur establishment_staff:',
          staffError
        )

        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', newUserId)

        await supabaseAdmin.auth.admin.deleteUser(
          newUserId
        )

        return Response.json(
          {
            error:
              'Impossible de rattacher le compte à l’établissement.',
            details: staffError.message,
          },
          { status: 400 }
        )
      }

      console.log(
        'Étape 7 OK - compte rattaché à l’établissement'
      )

      // --------------------------------------------------
      // 10. Succès
      // --------------------------------------------------

      return Response.json({
        success: true,

        user: {
          id: newUserId,
          email: normalizedEmail,
          name: name.trim(),
          role,
          staff_role: staffRole,
        },

        establishment: {
          id: establishment.id,
          name: establishment.name,
          slug: establishment.slug,
        },
      })
    } catch (error) {
      console.error(
        'ERREUR INATTENDUE create-staff-account:',
        error
      )

      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Erreur serveur inconnue.',
        },
        { status: 500 }
      )
    }
  }),
}