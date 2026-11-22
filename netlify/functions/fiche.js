import { neon } from "@neondatabase/serverless";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const text = (v, max = 5000) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().slice(0, max);
  return s === "" ? null : s;
};
const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n < 1000000 ? n : null;
};
const bool = (v) => (v === "oui" ? true : v === "non" ? false : null);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : null);

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée" });
  if (!process.env.DATABASE_URL) return json(500, { error: "Configuration serveur manquante" });

  let b;
  try {
    b = await req.json();
  } catch {
    return json(400, { error: "Requête invalide" });
  }

  // Honeypot anti-spam
  if (b.website) return json(200, { ok: true });

  const required = {
    entreprise: "Entreprise / organisation",
    interlocuteur: "Interlocuteur et fonction",
    telephone_email: "Téléphone / e-mail",
    objet_demande: "Objet de la demande",
    description_symptomes: "Description et symptômes",
  };
  const missing = Object.entries(required)
    .filter(([k]) => !text(b[k]))
    .map(([, label]) => label);
  if (missing.length) return json(400, { error: "Champs obligatoires manquants : " + missing.join(", ") });

  const reference = "FIC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") +
    "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      INSERT INTO fiches_client (
        reference, entreprise, interlocuteur, telephone_email, adresse_site, contact_prefere,
        nb_utilisateurs, nb_pc, systemes_equipements, fournisseur_internet, reseau_serveurs_cloud, applications_critiques,
        objet_demande, description_symptomes, date_debut, utilisateurs_impactes, impact_urgence, tests_effectues, pieces_jointes,
        assistance_distance, intervention_site, personne_validation, systemes_autorises, restrictions_donnees,
        reference_devis, perimetre_budget, validation_nom_date_signature,
        travaux_realises, points_non_resolus, recommandations, confirmation_client
      ) VALUES (
        ${reference}, ${text(b.entreprise, 300)}, ${text(b.interlocuteur, 300)}, ${text(b.telephone_email, 300)},
        ${text(b.adresse_site, 500)}, ${text(b.contact_prefere, 300)},
        ${int(b.nb_utilisateurs)}, ${int(b.nb_pc)}, ${text(b.systemes_equipements)}, ${text(b.fournisseur_internet, 300)},
        ${text(b.reseau_serveurs_cloud)}, ${text(b.applications_critiques)},
        ${text(b.objet_demande, 500)}, ${text(b.description_symptomes)}, ${date(b.date_debut)},
        ${text(b.utilisateurs_impactes, 300)}, ${text(b.impact_urgence)}, ${text(b.tests_effectues)}, ${text(b.pieces_jointes)},
        ${bool(b.assistance_distance)}, ${bool(b.intervention_site)}, ${text(b.personne_validation, 300)},
        ${text(b.systemes_autorises)}, ${text(b.restrictions_donnees)},
        ${text(b.reference_devis, 300)}, ${text(b.perimetre_budget)}, ${text(b.validation_nom_date_signature, 500)},
        ${text(b.travaux_realises)}, ${text(b.points_non_resolus)}, ${text(b.recommandations)}, ${text(b.confirmation_client, 500)}
      )`;
    return json(201, { ok: true, reference });
  } catch (e) {
    console.error("DB error", e.message);
    return json(500, { error: "Erreur lors de l'enregistrement. Réessayez." });
  }
};

export const config = { path: "/api/fiche" };
