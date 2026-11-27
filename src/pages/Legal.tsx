import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { LEGAL, LEGAL_DOCS, LEGAL_UPDATED_AT, type LegalDocSlug } from '@/config/legal';

const H2 = ({ children }: { children: ReactNode }) => <h2 className="mt-10 font-display text-2xl text-[#00DFA5]">{children}</h2>;
const H3 = ({ children }: { children: ReactNode }) => <h3 className="mt-6 text-base font-semibold text-white">{children}</h3>;
const P = ({ children }: { children: ReactNode }) => <p className="mt-3 text-sm leading-7 text-white/70">{children}</p>;
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-white/70">
    {items.map((item, index) => <li key={index}>{item}</li>)}
  </ul>
);
const Mail = () => <a className="text-[#00DFA5] underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;
const DocLink = ({ slug, children }: { slug: LegalDocSlug; children: ReactNode }) => (
  <Link className="text-[#00DFA5] underline" to={`/legal/${slug}`}>{children}</Link>
);

function Identity() {
  return (
    <UL items={[
      <>Éditeur et vendeur : {LEGAL.ownerName}, {LEGAL.legalStatus}, exploitant la marque {LEGAL.brand}</>,
      <>Adresse : {LEGAL.address}</>,
      <>ICE : {LEGAL.ice} · Identifiant fiscal : {LEGAL.fiscalId} · Registre national de l’auto-entrepreneur : {LEGAL.rnaeNumber}</>,
      <>Contact : <Mail />{LEGAL.phone ? <> · {LEGAL.phone}</> : null}</>,
    ]} />
  );
}

function MentionsLegales() {
  return <>
    <H2>Éditeur</H2>
    <Identity />
    <P>Directeur de la publication : {LEGAL.ownerName}.</P>
    {LEGAL.cndpReceipt && <P>Traitements de données déclarés auprès de la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP) sous le récépissé n° {LEGAL.cndpReceipt}.</P>}

    <H2>Hébergement</H2>
    <UL items={[
      <>Application web : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis (vercel.com).</>,
      <>Base de données et serveurs applicatifs : Supabase Inc. (supabase.com), données hébergées dans un centre de données Amazon Web Services situé en Irlande (Union européenne).</>,
    ]} />

    <H2>Propriété intellectuelle</H2>
    <P>La marque {LEGAL.brand}, le logiciel, son interface, ses textes et ses éléments graphiques sont la propriété de l’éditeur. Toute reproduction ou réutilisation sans autorisation écrite est interdite. Les logos, photos, menus et contenus publiés par les établissements restent leur propriété.</P>

    <H2>Documents applicables</H2>
    <UL items={[
      <><DocLink slug="cgv">Conditions générales de vente</DocLink> : abonnement des établissements.</>,
      <><DocLink slug="cgu">Conditions d’utilisation</DocLink> : cartes de fidélité, avis et pages publiques pour les clients des établissements.</>,
      <><DocLink slug="confidentialite">Politique de confidentialité</DocLink> : données personnelles et cookies.</>,
    ]} />
  </>;
}

function Cgv() {
  return <>
    <P>Les présentes conditions générales de vente (« CGV ») s’appliquent à tout abonnement souscrit par un professionnel (l’« Établissement ») auprès de l’éditeur de {LEGAL.brand} (le « Prestataire »). Elles constituent, avec la <DocLink slug="confidentialite">politique de confidentialité</DocLink>, l’intégralité de l’accord entre les parties. L’Établissement les accepte en créant son compte.</P>

    <H2>1. Prestataire</H2>
    <Identity />

    <H2>2. Services</H2>
    <P>{LEGAL.brand} est une application en ligne (logiciel en tant que service) permettant à un établissement de gérer : sa page publique, la collecte et le suivi d’avis, un programme de fidélité (cartes, tampons, points, récompenses, parrainage, tirages au sort), un menu en ligne, des promotions, des notifications, la messagerie WhatsApp, des statistiques et des outils d’assistance par intelligence artificielle. Le contenu exact dépend de la formule choisie.</P>

    <H2>3. Formules et prix</H2>
    <UL items={[
      <>Basic : 299 MAD par mois — page publique, avis et réputation, contact.</>,
      <>Premium : 499 MAD par mois — Basic, plus fidélité, menu, promotions et statistiques.</>,
      <>Enterprise : 799 MAD par mois — Premium, plus assistant IA et gestion avancée.</>,
    ]} />
    <P>Les prix sont exprimés en dirhams marocains. Le Prestataire, auto-entrepreneur, est hors du champ d’application de la TVA marocaine : les prix sont nets, sans TVA. Pour un Établissement situé dans l’Union européenne, la TVA éventuellement due dans son pays est autoliquidée par l’Établissement. Les frais bancaires et de change éventuels sont à la charge de l’Établissement. Le Prestataire peut modifier ses prix en prévenant l’Établissement par email au moins 30 jours avant ; le nouveau prix s’applique à la période suivante, et l’Établissement peut résilier avant.</P>
    <P>Une période d’essai gratuite peut être accordée ; sa durée est indiquée dans l’espace de l’Établissement. À la fin de l’essai, l’accès aux fonctions payantes est suspendu tant que le premier paiement n’est pas reçu.</P>

    <H2>4. Paiement et facturation</H2>
    <P>L’abonnement est payable d’avance, au début de chaque période mensuelle, par virement bancaire, en espèces ou par chèque. Une facture est remise pour chaque paiement. En cas de retard de paiement de plus de 15 jours après relance, le Prestataire peut suspendre l’accès aux fonctions payantes jusqu’au règlement. Les données de l’Établissement sont conservées pendant la suspension.</P>

    <H2>5. Durée et résiliation</H2>
    <P>L’abonnement est sans engagement. Il est conclu pour un mois et se renouvelle automatiquement chaque mois. L’Établissement peut résilier à tout moment par email à <Mail /> : la résiliation prend effet à la fin du mois en cours déjà payé, sans remboursement au prorata. Le Prestataire peut résilier avec un préavis de 30 jours, ou immédiatement en cas de manquement grave de l’Établissement (notamment usage illicite, faux avis, envoi de messages non sollicités ou impayé persistant).</P>
    <P>Après la fin de l’abonnement, l’Établissement dispose de 30 jours pour demander un export de ses données. Passé ce délai, les données de l’Établissement et de ses clients sont supprimées, à l’exception des documents comptables que la loi impose de conserver.</P>

    <H2>6. Obligations de l’Établissement</H2>
    <UL items={[
      'Fournir des informations exactes et garder ses identifiants confidentiels ; il est responsable des actions de ses employés et responsables.',
      'Publier uniquement des contenus (logos, photos, menus, prix, promotions) dont il détient les droits et qui sont exacts.',
      'Honorer les récompenses, promotions et lots de tirage au sort qu’il propose à ses clients : le Prestataire n’en est pas garant.',
      'Respecter les règles des plateformes tierces qu’il connecte, notamment les règles de Google relatives aux avis, celles de Meta pour WhatsApp et celles de Google Wallet. Il choisit seul le paramétrage de sa page d’avis et en assume la conformité.',
      'N’envoyer des communications commerciales qu’aux clients qui y ont consenti, et respecter les lois sur la protection des données applicables à son activité.',
    ]} />

    <H2>7. Disponibilité et assistance</H2>
    <P>Le Prestataire met en œuvre les moyens raisonnables pour que le service soit accessible en continu, sans garantie d’absence d’interruption. Des maintenances peuvent avoir lieu, si possible en dehors des heures de forte activité. L’assistance est assurée par email à <Mail />.</P>

    <H2>8. Services de tiers et intelligence artificielle</H2>
    <P>Certaines fonctions reposent sur des services tiers (Google Business Profile, Google Wallet, WhatsApp de Meta, notifications des navigateurs, fournisseur d’IA). Leur disponibilité et leurs conditions dépendent de ces tiers. Les contenus générés par l’IA (réponses aux avis, textes, menus, visuels, analyses) sont des propositions : l’Établissement doit les relire avant publication et en reste responsable.</P>

    <H2>9. Responsabilité</H2>
    <P>Le Prestataire est tenu d’une obligation de moyens. Il n’est pas responsable des dommages indirects (perte de chiffre d’affaires, de clientèle ou d’image), ni des contenus publiés par l’Établissement ou ses clients, ni des défaillances de services tiers. Dans tous les cas, sa responsabilité totale est limitée aux sommes payées par l’Établissement au cours des 12 derniers mois. Ces limites ne s’appliquent pas en cas de faute lourde ou intentionnelle.</P>

    <H2>10. Données personnelles et sous-traitance</H2>
    <P>Pour les données de ses propres clients (cartes de fidélité, avis, contacts), l’Établissement est responsable du traitement et le Prestataire agit comme sous-traitant, au sens de la loi marocaine n° 09-08 et, le cas échéant, de l’article 28 du règlement européen 2016/679 (RGPD). À ce titre, le Prestataire s’engage à :</P>
    <UL items={[
      'traiter ces données uniquement pour fournir le service et selon les instructions de l’Établissement données via l’application ;',
      'garantir la confidentialité des données et limiter leur accès aux personnes qui en ont besoin ;',
      'mettre en place des mesures de sécurité adaptées (chiffrement des échanges, contrôle d’accès par établissement, sauvegardes) ;',
      <>recourir uniquement aux sous-traitants ultérieurs listés dans la <DocLink slug="confidentialite">politique de confidentialité</DocLink>, et informer l’Établissement de tout changement, qu’il peut refuser en résiliant ;</>,
      'aider l’Établissement à répondre aux demandes d’exercice des droits de ses clients ;',
      'notifier à l’Établissement toute violation de données le concernant dans les meilleurs délais et au plus tard 72 heures après en avoir eu connaissance ;',
      'supprimer ou restituer les données à la fin de l’abonnement, comme indiqué à l’article 5 ;',
      'mettre à disposition les informations nécessaires pour démontrer le respect de ces obligations.',
    ]} />
    <P>Les données de l’Établissement lui-même (compte, facturation) sont traitées par le Prestataire en tant que responsable du traitement, selon la politique de confidentialité.</P>

    <H2>11. Propriété intellectuelle</H2>
    <P>Le Prestataire concède à l’Établissement, pour la durée de l’abonnement, un droit d’utilisation personnel et non transférable de l’application. L’Établissement autorise le Prestataire à héberger et afficher ses contenus pour fournir le service, et à citer son nom comme référence commerciale sauf refus de sa part par email.</P>

    <H2>12. Modification des CGV</H2>
    <P>Le Prestataire peut modifier les CGV. L’Établissement est informé par email au moins 30 jours avant l’entrée en vigueur ; s’il n’accepte pas, il peut résilier avant cette date.</P>

    <H2>13. Droit applicable et litiges</H2>
    <P>Les CGV sont soumises au droit marocain. En cas de différend, les parties recherchent d’abord une solution amiable pendant 30 jours. À défaut, le litige est porté devant les tribunaux compétents de {LEGAL.court}. Si l’Établissement est situé dans l’Union européenne, les dispositions impératives de son pays restent applicables.</P>
  </>;
}

function Cgu() {
  return <>
    <P>Ces conditions s’appliquent à toute personne qui utilise une page publique, un formulaire d’avis ou une carte de fidélité proposés par un établissement (restaurant, café, commerce…) via {LEGAL.brand}. En créant une carte ou en envoyant un avis, vous les acceptez.</P>

    <H2>1. Qui fait quoi</H2>
    <P>L’établissement que vous visitez propose le programme de fidélité, les récompenses et les offres. {LEGAL.brand} fournit l’outil technique à cet établissement. Pour toute question sur une récompense, une offre ou un tirage au sort, adressez-vous d’abord à l’établissement.</P>

    <H2>2. Carte de fidélité</H2>
    <UL items={[
      'La carte est gratuite. Elle est personnelle : une carte par personne et par établissement, liée à votre numéro de téléphone.',
      'Les tampons ou points sont ajoutés par l’établissement lors de vos achats ou visites, selon ses règles affichées sur la carte.',
      'Les récompenses, tampons et points n’ont aucune valeur monétaire, ne sont ni échangeables contre de l’argent ni cessibles, et ne peuvent être utilisés que dans l’établissement concerné.',
      'L’établissement peut modifier ou arrêter son programme. Il lui appartient de vous en informer et de traiter loyalement les récompenses déjà acquises.',
      'Le lien d’accès à votre carte est personnel : ne le partagez pas. En cas de perte, utilisez la fonction de récupération de carte.',
      'Toute fraude (fausse identité, cartes multiples, manipulation des tampons ou du parrainage) peut entraîner l’annulation de la carte et des avantages.',
    ]} />

    <H2>3. Parrainage et tirages au sort</H2>
    <P>Lorsque l’établissement propose un parrainage ou un tirage au sort, les avantages, conditions et dates sont fixés par l’établissement, qui en est seul organisateur et responsable de la remise des lots.</P>

    <H2>4. Avis et commentaires</H2>
    <P>Vos avis doivent refléter une expérience réelle et rester respectueux : pas de propos injurieux, diffamatoires, discriminatoires ni de données personnelles d’autrui. Un avis envoyé via le formulaire privé est transmis à l’établissement. Les avis publiés sur Google ou TripAdvisor sont soumis aux conditions de ces plateformes.</P>

    <H2>5. Notifications</H2>
    <P>Vous ne recevez des notifications ou offres que si vous les avez acceptées. Vous pouvez les désactiver à tout moment depuis votre carte ou les réglages de votre téléphone, ou en demandant l’arrêt à l’établissement.</P>

    <H2>6. Âge</H2>
    <P>La carte de fidélité est réservée aux personnes de 16 ans et plus. En dessous de cet âge, l’accord d’un parent est nécessaire.</P>

    <H2>7. Vos données</H2>
    <P>La manière dont vos données sont utilisées et vos droits sont décrits dans la <DocLink slug="confidentialite">politique de confidentialité</DocLink>.</P>

    <H2>8. Responsabilité et droit applicable</H2>
    <P>{LEGAL.brand} met en œuvre les moyens raisonnables pour que le service fonctionne, sans garantir une disponibilité permanente. Ces conditions sont soumises au droit marocain, sans vous priver des protections impératives de votre pays de résidence. Contact : <Mail />.</P>
  </>;
}

function Confidentialite() {
  return <>
    <P>Cette politique explique quelles données sont traitées par {LEGAL.brand}, pourquoi, combien de temps et quels sont vos droits. Elle respecte la loi marocaine n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel et, pour les personnes situées dans l’Union européenne, le règlement général sur la protection des données (RGPD).</P>

    <H2>1. Qui est responsable</H2>
    <UL items={[
      <><strong>Données des clients d’un établissement</strong> (carte de fidélité, avis, contacts) : l’établissement est responsable du traitement. {LEGAL.brand} agit pour son compte comme sous-traitant.</>,
      <><strong>Données des établissements et de leurs employés</strong> (comptes, abonnement) : l’éditeur de {LEGAL.brand} est responsable du traitement.</>,
    ]} />
    <Identity />

    <H2>2. Données traitées</H2>
    <H3>Clients des établissements</H3>
    <UL items={[
      'Identité et contact : prénom, nom, numéro de téléphone, email (facultatif).',
      'Jour et mois d’anniversaire (sans l’année), centres d’intérêt et canal de contact préféré, s’ils sont renseignés.',
      'Programme de fidélité : tampons, points, récompenses, historique des passages, parrainage, participations aux tirages au sort.',
      'Avis et retours : note, commentaire, et coordonnées si vous les laissez.',
      'Consentements : notifications, communications commerciales, localisation, avec leur date.',
      'Abonnement aux notifications du téléphone (adresse technique fournie par le navigateur).',
      'Localisation : uniquement si vous l’avez autorisée, votre position sert sur le moment à savoir si vous êtes près de l’établissement. Elle n’est pas enregistrée.',
    ]} />
    <H3>Établissements et employés</H3>
    <UL items={[
      'Nom, email, mot de passe (stocké sous forme chiffrée), rôle et établissements rattachés.',
      'Informations de l’établissement, contenus publiés, paramètres, abonnement et paiements.',
      'Connexions aux services Google et WhatsApp lorsque l’établissement les active.',
    ]} />

    <H2>3. Finalités et bases légales</H2>
    <UL items={[
      'Gérer la carte de fidélité, les récompenses et le parrainage : exécution du service demandé.',
      'Recueillir et transmettre les avis à l’établissement : exécution du service demandé.',
      'Envoyer des notifications et offres (push, WhatsApp, SMS, email, à proximité) : votre consentement, retirable à tout moment.',
      'Fournir l’application aux établissements, facturer et assister : exécution du contrat ; conservation des factures : obligation légale.',
      'Sécurité, prévention de la fraude et statistiques agrégées : intérêt légitime.',
    ]} />
    <P>Aucune donnée n’est vendue. Aucune publicité tierce n’est affichée.</P>

    <H2>4. Destinataires et sous-traitants</H2>
    <P>Les données d’un client ne sont accessibles qu’à l’établissement concerné et à ses employés autorisés, ainsi qu’aux prestataires techniques suivants, dans la limite de leur mission :</P>
    <UL items={[
      'Supabase Inc. : base de données, authentification et serveurs applicatifs — hébergement en Irlande (Union européenne).',
      'Vercel Inc. : hébergement de l’application web — États-Unis et réseau mondial de diffusion.',
      'Resend : envoi des emails de compte (confirmation, mot de passe) — États-Unis.',
      'OpenAI : fonctions d’intelligence artificielle (réponses et analyse d’avis, menus, visuels) — États-Unis. Les textes d’avis peuvent lui être transmis lorsque l’établissement utilise ces fonctions ; ils ne sont pas utilisés pour entraîner ses modèles via l’API.',
      'Meta Platforms (WhatsApp) : messages WhatsApp lorsque l’établissement active cette fonction.',
      'Google : synchronisation des avis Google Business Profile et cartes Google Wallet lorsque l’établissement les active.',
      'Services de notification des navigateurs (Google, Apple, Mozilla) : acheminement des notifications du téléphone.',
    ]} />

    <H2>5. Transferts hors du Maroc et de l’Union européenne</H2>
    <P>Certains prestataires sont situés hors du Maroc, et certains hors de l’Union européenne. Ces transferts sont nécessaires au fonctionnement du service et sont encadrés, selon le cas, par l’autorisation ou la notification auprès de la CNDP prévue par la loi 09-08, par les clauses contractuelles types de la Commission européenne ou par le cadre de protection des données UE–États-Unis. En utilisant le service, vous êtes informé de ces transferts.</P>

    <H2>6. Durées de conservation</H2>
    <UL items={[
      'Carte de fidélité : tant qu’elle est active, puis suppression au plus tard 3 ans après la dernière activité, ou plus tôt sur demande.',
      'Avis et retours privés : 3 ans au maximum.',
      'Consentements et leur preuve : pendant la durée d’utilisation, puis 3 ans.',
      'Données d’un établissement et de ses clients après la fin de l’abonnement : 30 jours, puis suppression.',
      'Factures et pièces comptables : 10 ans, conformément à la loi.',
    ]} />

    <H2>7. Sécurité</H2>
    <P>Les échanges sont chiffrés (HTTPS). Les accès sont cloisonnés par établissement et contrôlés au niveau de la base de données. Les mots de passe sont chiffrés. Les cartes sont accessibles par un lien personnel non devinable.</P>

    <H2>8. Vos droits</H2>
    <P>Vous disposez d’un droit d’accès, de rectification, d’opposition (y compris à la prospection, sans justification), de suppression, de limitation et de portabilité, ainsi que du droit de retirer votre consentement à tout moment. Pour un programme de fidélité, adressez-vous de préférence à l’établissement ; vous pouvez aussi écrire à <Mail /> et nous transmettrons ou traiterons la demande dans un délai d’un mois. Une preuve d’identité peut être demandée en cas de doute.</P>
    <P>Vous pouvez introduire une réclamation auprès de la CNDP (www.cndp.ma) au Maroc ou, si vous résidez dans l’Union européenne, auprès de votre autorité de protection des données (en France : la CNIL, www.cnil.fr).</P>

    <H2>9. Cookies et stockage local</H2>
    <P>{LEGAL.brand} n’utilise ni cookie publicitaire, ni outil de mesure d’audience tiers. L’application utilise uniquement le stockage local du navigateur, strictement nécessaire à son fonctionnement : maintien de votre session, accès à votre carte et préférences d’affichage. Ce stockage ne nécessite pas de consentement ; vous pouvez l’effacer depuis les réglages de votre navigateur, ce qui vous déconnectera.</P>

    <H2>10. Modifications</H2>
    <P>Cette politique peut évoluer. La date de mise à jour figure en haut de la page ; en cas de changement important, les établissements sont prévenus par email.</P>
  </>;
}

const CONTENT: Record<LegalDocSlug, () => JSX.Element> = {
  'mentions-legales': MentionsLegales,
  cgv: Cgv,
  cgu: Cgu,
  confidentialite: Confidentialite,
};

export default function Legal() {
  const { doc } = useParams();
  const current = LEGAL_DOCS.find(item => item.slug === doc);
  if (!current) return <Navigate to="/legal/mentions-legales" replace />;
  const Content = CONTENT[current.slug];

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="font-display text-2xl tracking-[0.12em] text-[#00DFA5]">KELYANI</Link>
        <nav aria-label="Documents légaux" className="mt-8 flex flex-wrap gap-2">
          {LEGAL_DOCS.map(item => (
            <Link
              key={item.slug}
              to={`/legal/${item.slug}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${item.slug === current.slug ? 'border-[#00DFA5] bg-[#00DFA5] text-[#050505]' : 'border-white/15 text-white/60 hover:border-[#00DFA5] hover:text-[#00DFA5]'}`}
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <h1 className="mt-10 font-display text-4xl text-white">{current.title}</h1>
        <p className="mt-2 text-xs text-white/40">Dernière mise à jour : {LEGAL_UPDATED_AT}</p>
        <article className="pb-16">
          <Content />
        </article>
      </div>
    </main>
  );
}
