The country flag atlas is rendered from **flag-icons 7.5.0**, by Lipis and contributors,
under the MIT licence in [LICENSE.txt](LICENSE.txt).
Source: https://github.com/lipis/flag-icons/tree/v7.5.0
Package: https://registry.npmjs.org/flag-icons/-/flag-icons-7.5.0.tgz

`countries.png` holds the 197 countries listed in `countries.js`, in 14 columns.
Each displayed flag is 24 × 18 pixels, rendered at three times that resolution.
`country-flags.css` maps the existing country codes to their image positions.
Flags load from the site itself and work offline; Windows does not need flag emoji support.
The adjacent country name is the accessible label, so flags are decorative (`aria-hidden`).

To rebuild after a source or country-list change, extract the pinned npm package into
a scratch directory and run `node scripts/build-country-flags.js /path/to/package`.
Commit the regenerated image and CSS together and run `node scripts/stamp-versions.js`.
