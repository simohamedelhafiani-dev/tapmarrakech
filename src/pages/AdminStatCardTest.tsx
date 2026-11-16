b-6 rounded-2xl border border-[#00DFA5]/30 bg-[#686D76] p-5 text-sm text-[#00DFA5]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Avis reçus"
            value={data?.reviewsCount ?? '—'}
            icon={MessageSquare}
            iconTone="indigo"
            trend={data?.reviewGrowth}
          />

          <StatCard
            label="Note moyenne"
            value={data ? data.averageRating.toFixed(2) : '—'}
            icon={Star}
            iconTone="amber"
            hint="Sur 5.00"
          />

          <StatCard
            label="Clients fidélisés"
            value={data?.loyaltyCustomersCount ?? '—'}
            icon={UsersRound}
            iconTone="emerald"
            trend={data?.registrationGrowth}
          />
        </div>

        {status === 'loading' ? (
          <p className="mt-6 text-xs font-medium text-[#6B7280]">
            Chargement des données réelles…
          </p>
        ) : null}
      </div>
    </main>
  );
}

