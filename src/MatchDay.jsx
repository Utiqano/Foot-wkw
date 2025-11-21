import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

export default function MatchDay({ user }) {
  const [nextThursday, setNextThursday] = useState("");
  const [participations, setParticipations] = useState([]);
  const [userChoice, setUserChoice] = useState(null);
  const [draw, setDraw] = useState(null);
  const [votes, setVotes] = useState([]);
  const [userVote, setUserVote] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false); // ← LE SECRET ANTI-FREEZE

  // === NEXT THURSDAY ===
  useEffect(() => {
    const calcThursday = () => {
      const today = new Date();
      const day = today.getDay();
      const diff = day <= 4 ? 4 - day : 11 - day;
      const thursday = new Date(today);
      thursday.setDate(today.getDate() + diff);
      setNextThursday(thursday.toLocaleDateString("fr-FR"));
    };
    calcThursday();
    const interval = setInterval(calcThursday, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentWeek = (() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day <= 4 ? 4 - day : 11 - day;
    const th = new Date(today);
    th.setDate(today.getDate() + diff);
    return th.toISOString().split("T")[0];
  })();

  const isFridayOrLater = new Date().getDay() >= 5;

  // === LOAD DATA (optimized) ===
  const loadData = useCallback(async () => {
    const { data: parts } = await supabase
      .from("match_participation")
      .select("*")
      .eq("week_date", currentWeek);

    const { data: drawData } = await supabase
      .from("team_draws")
      .select("*")
      .eq("week_date", currentWeek)
      .maybeSingle();

    const { data: voteData } = await supabase
      .from("mvp_votes")
      .select("*")
      .eq("week_date", currentWeek);

    setParticipations(parts || []);
    setDraw(drawData || null);
    setVotes(voteData || []);

    const myPart = parts?.find((p) => p.user_id === user.id);
    setUserChoice(myPart ? myPart.participates : null);

    const myVote = voteData?.find((v) => v.voter_id === user.id);
    setUserVote(myVote?.voted_for_email || null);
  }, [currentWeek, user.id]);

  // === REALTIME (filtered + stable) ===
  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`matchday-${currentWeek}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_participation",
          filter: `week_date=eq.${currentWeek}`,
        },
        () => loadData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_draws",
          filter: `week_date=eq.${currentWeek}`,
        },
        (payload) => setDraw(payload.new || null)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mvp_votes",
          filter: `week_date=eq.${currentWeek}`,
        },
        () => loadData()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentWeek, loadData]);

  // === PARTICIPATION (UPSERT = NO FREEZE) ===
  const sendChoice = async (choice) => {
    if (isProcessing) return;
    setIsProcessing(true);

    // 1. Update LOCAL instantané (tu vois ton nom tout de suite)
    setUserChoice(choice);
    setParticipations((prev) => {
      const filtered = prev.filter((p) => p.user_id !== user.id);
      return [
        ...filtered,
        {
          user_id: user.id,
          user_email: user.email,
          participates: choice,
          week_date: currentWeek,
        },
      ];
    });

    // 2. Envoi réel à Supabase (delete + insert séparés → fonctionne à 100 %)
    try {
      // On supprime d'abord l'ancienne réponse s'il y en a une
      await supabase
        .from("match_participation")
        .delete()
        .eq("user_id", user.id)
        .eq("week_date", currentWeek);

      // Puis on insère la nouvelle
      const { error } = await supabase.from("match_participation").insert({
        user_id: user.id,
        user_email: user.email,
        participates: choice,
        week_date: currentWeek,
      });

      if (error) throw error;
    } catch (err) {
      alert("Erreur réseau, réessaie");
      // Si erreur → on recharge depuis le serveur pour corriger l'état local
      loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  // === TIRAGE & MVP (inchangés) ===
  const launchDraw = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const presents = participations
      .filter((p) => p.participates)
      .map((p) => p.user_email.split("@")[0]);

    if (presents.length < 10) {
      alert("Il faut minimum 10 joueurs !");
      setIsProcessing(false);
      return;
    }

    const shuffled = [...presents].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);

    await supabase.from("team_draws").upsert({
      week_date: currentWeek,
      team1: shuffled.slice(0, half),
      team2: shuffled.slice(half),
      created_by: user.email.split("@")[0],
    });
    setIsProcessing(false);
  };

  const voteMVP = async (email) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await supabase
      .from("mvp_votes")
      .delete()
      .eq("voter_id", user.id)
      .eq("week_date", currentWeek);
    await supabase.from("mvp_votes").insert({
      voter_id: user.id,
      voter_email: user.email,
      voted_for_email: email,
      week_date: currentWeek,
    });
    setIsProcessing(false);
  };

  // === LISTES ===
  const presentPlayers = participations
    .filter((p) => p.participates)
    .map((p) => ({ name: p.user_email.split("@")[0], email: p.user_email }));

  const voteCounts = presentPlayers
    .map((p) => ({
      ...p,
      count: votes.filter((v) => v.voted_for_email === p.email).length,
    }))
    .sort((a, b) => b.count - a.count);

  const mvp = voteCounts[0]?.count > 0 ? voteCounts[0] : null;

  return (
    <div className="match-day-card">
      {isProcessing && <div className="overlay-loader">⏳</div>}

      <h3>⚽ Jour de Match</h3>
      <p className="date">
        Jeudi <strong>{nextThursday}</strong>
      </p>

      {/* PARTICIPATION */}
      {userChoice === null ? (
        <div className="choice-buttons">
          <button
            onClick={() => sendChoice(true)}
            className="yes"
            disabled={isProcessing}
          >
            Je participe ✅
          </button>
          <button
            onClick={() => sendChoice(false)}
            className="no"
            disabled={isProcessing}
          >
            Je ne participe pas ❌
          </button>
        </div>
      ) : (
        <p className="already">
          Tu es : {userChoice ? "✅ Présent" : "❌ Absent"}
        </p>
      )}

      <div className="teams">
        <div className="team">
          <h4>Présents ({presentPlayers.length})</h4>
          {presentPlayers.map((p) => p.name).join(", ") || "Personne encore"}
        </div>
      </div>

      {/* TIRAGE */}
      {presentPlayers.length >= 10 && !draw && (
        <button
          onClick={launchDraw}
          className="draw-btn"
          disabled={isProcessing}
        >
          🎯 LANCER LE TIRAGE AU SORT
        </button>
      )}

      {draw && (
        <div className="draw-result">
          <h4>Tirage par {draw.created_by}</h4>
          <div className="equipes">
            <div className="equipe">
              <h5>Équipe 1 ⚡</h5>
              {draw.team1.join(" • ")}
            </div>
            <div className="equipe">
              <h5>Équipe 2 🔥</h5>
              {draw.team2.join(" • ")}
            </div>
          </div>
        </div>
      )}

      {/* MVP VOTING */}
      {isFridayOrLater && presentPlayers.length > 0 && (
        <div className="mvp-section">
          <h3 className="mvp-title">🏆 MVP de la semaine</h3>
          {mvp && (
            <div className="mvp-winner">
              ⭐ {mvp.name} EST MVP ! ({mvp.count} votes)
            </div>
          )}
          <div className="mvp-votes">
            {voteCounts.map((p) => (
              <div key={p.email} className="mvp-candidate">
                <div className="candidate-info">
                  <span>{p.name}</span>
                  <span>
                    {p.count} vote{p.count > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${mvp ? (p.count / mvp.count) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                {userChoice === true && (
                  <button
                    onClick={() => voteMVP(p.email)}
                    className={userVote === p.email ? "voted" : "vote-btn"}
                    disabled={isProcessing}
                  >
                    {userVote === p.email ? "✔ Voté" : "Voter"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
