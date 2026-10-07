// Aggregate countries of origin supplied for the EU-HEM 2026–2028 cohort.
// This overview contains counts only. It has no connection to directory profiles,
// and countries of origin do not establish citizenship or immigration status.
(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  if (root) root.EUHEM_COHORT = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const countries = [
    { code: "AT", name: "Austria", count: 2, continent: "Europe", group: "eu" },
    { code: "BE", name: "Belgium", count: 1, continent: "Europe", group: "eu" },
    { code: "HR", name: "Croatia", count: 1, continent: "Europe", group: "eu" },
    { code: "FR", name: "France", count: 1, continent: "Europe", group: "eu" },
    { code: "DE", name: "Germany", count: 15, continent: "Europe", group: "eu" },
    { code: "GR", name: "Greece", count: 1, continent: "Europe", group: "eu" },
    { code: "IT", name: "Italy", count: 20, continent: "Europe", group: "eu" },
    { code: "LU", name: "Luxembourg", count: 1, continent: "Europe", group: "eu" },
    { code: "NL", name: "Netherlands", count: 35, continent: "Europe", group: "eu" },
    { code: "PL", name: "Poland", count: 1, continent: "Europe", group: "eu" },
    { code: "PT", name: "Portugal", count: 1, continent: "Europe", group: "eu" },
    { code: "RO", name: "Romania", count: 1, continent: "Europe", group: "eu" },
    { code: "ES", name: "Spain", count: 5, continent: "Europe", group: "eu" },
    { code: "IS", name: "Iceland", count: 1, continent: "Europe", group: "eea" },
    { code: "NO", name: "Norway", count: 7, continent: "Europe", group: "eea" },
    { code: "BR", name: "Brazil", count: 1, continent: "South America", group: "other" },
    { code: "IN", name: "India", count: 2, continent: "Asia", group: "other" },
    { code: "MN", name: "Mongolia", count: 1, continent: "Asia", group: "other" },
    { code: "MK", name: "North Macedonia", count: 1, continent: "Europe", group: "other" },
    { code: "PH", name: "Philippines", count: 2, continent: "Asia", group: "other" },
    { code: "ZA", name: "South Africa", count: 1, continent: "Africa", group: "other" },
    { code: "CH", name: "Switzerland", count: 1, continent: "Europe", group: "other" },
    { code: "SY", name: "Syria", count: 1, continent: "Asia", group: "other" },
    { code: "US", name: "USA", count: 2, continent: "North America", group: "other" },
  ].map(Object.freeze);

  const groups = {
    eu: Object.freeze({ label: "EU", description: "European Union" }),
    eea: Object.freeze({ label: "EEA outside the EU", description: "Iceland and Norway" }),
    other: Object.freeze({ label: "Other countries", description: "The source’s “Third countries” group" }),
  };

  return Object.freeze({
    id: "2026-2028",
    label: "2026–2028",
    source: Object.freeze({
      title: "Countries where you come from",
      notation: "103+2 pax",
      providedOn: "2026-10-08",
      note: "Country-of-origin counts supplied for this cohort. The source labels the total ‘103+2 pax’ without explaining the additional two people.",
    }),
    countries: Object.freeze(countries),
    groups: Object.freeze(groups),
    total: countries.reduce((sum, country) => sum + country.count, 0),
    countryCount: new Set(countries.map((country) => country.code)).size,
    continentCount: new Set(countries.map((country) => country.continent)).size,
  });
});
