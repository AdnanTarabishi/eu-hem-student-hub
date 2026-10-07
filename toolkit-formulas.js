/* Original Excel recipe library. Fixed worked examples, not an Excel execution engine.
 * English function names are retained. Separators and numeric literals can be adapted.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ToolkitFormulas=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const recipes = [
  {
    "id": "count",
    "title": "Count numeric observations",
    "category": "Describe",
    "template": "=COUNT({R})",
    "expected": 7,
    "why": "Counts numeric cells; it does not count blank cells as zero.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "sum",
    "title": "Sum the observations",
    "category": "Describe",
    "template": "=SUM({R})",
    "expected": 130,
    "why": "Adds numeric observations.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "mean",
    "title": "Arithmetic mean",
    "category": "Describe",
    "template": "=AVERAGE({R})",
    "expected": 18.571428571428573,
    "why": "The total divided by the number of numeric observations.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "median",
    "title": "Median",
    "category": "Describe",
    "template": "=MEDIAN({R})",
    "expected": 17,
    "why": "The middle ordered value, or the mean of the two middle values.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "mode",
    "title": "Most frequent value",
    "category": "Describe",
    "template": "=MODE.SNGL({R})",
    "expected": 14,
    "why": "Returns a mode; if no values repeat, Excel returns #N/A. Ties need consideration.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "min",
    "title": "Minimum",
    "category": "Describe",
    "template": "=MIN({R})",
    "expected": 12,
    "why": "Find the smallest numeric observation.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "max",
    "title": "Maximum",
    "category": "Describe",
    "template": "=MAX({R})",
    "expected": 28,
    "why": "Find the largest numeric observation.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "var-s",
    "title": "Sample variance",
    "category": "Describe",
    "template": "=VAR.S({R})",
    "expected": 35.285714285714285,
    "why": "Uses n − 1 when estimating a population variance from a sample.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "var-p",
    "title": "Population variance",
    "category": "Describe",
    "template": "=VAR.P({R})",
    "expected": 30.244897959183675,
    "why": "Uses n when describing the complete population represented by the data.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "sd-s",
    "title": "Sample standard deviation",
    "category": "Describe",
    "template": "=STDEV.S({R})",
    "expected": 5.94017796751194,
    "why": "Square root of the sample variance. Needs at least two observations.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "sd-p",
    "title": "Population standard deviation",
    "category": "Describe",
    "template": "=STDEV.P({R})",
    "expected": 5.499536158548617,
    "why": "Square root of the population variance.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "devsq",
    "title": "Sum of squared deviations",
    "category": "Describe",
    "template": "=DEVSQ({R})",
    "expected": 211.7142857142857,
    "why": "Sum of the squared distances from the sample mean; this is not yet a variance.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "range",
    "title": "Range",
    "category": "Describe",
    "template": "=MAX({R})-MIN({R})",
    "expected": 16,
    "why": "Maximum minus minimum; sensitive to extreme observations.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "q1-inc",
    "title": "Q1 · inclusive",
    "category": "Describe",
    "template": "=QUARTILE.INC({R},1)",
    "expected": 14,
    "why": "Use the quartile convention required by your course. INC and EXC can legitimately differ.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Do not mix conventions within an IQR or box plot. EXC can reject ranks outside the observed range in very small samples.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "q3-inc",
    "title": "Q3 · inclusive",
    "category": "Describe",
    "template": "=QUARTILE.INC({R},3)",
    "expected": 22.5,
    "why": "Use the quartile convention required by your course. INC and EXC can legitimately differ.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Do not mix conventions within an IQR or box plot. EXC can reject ranks outside the observed range in very small samples.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "q1-exc",
    "title": "Q1 · exclusive",
    "category": "Describe",
    "template": "=QUARTILE.EXC({R},1)",
    "expected": 14,
    "why": "Use the quartile convention required by your course. INC and EXC can legitimately differ.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Do not mix conventions within an IQR or box plot. EXC can reject ranks outside the observed range in very small samples.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "q3-exc",
    "title": "Q3 · exclusive",
    "category": "Describe",
    "template": "=QUARTILE.EXC({R},3)",
    "expected": 24,
    "why": "Use the quartile convention required by your course. INC and EXC can legitimately differ.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Do not mix conventions within an IQR or box plot. EXC can reject ranks outside the observed range in very small samples.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "iqr",
    "title": "Interquartile range · inclusive",
    "category": "Describe",
    "template": "=QUARTILE.INC({R},3)-QUARTILE.INC({R},1)",
    "expected": 8.5,
    "why": "Subtract Q1 from Q3 using the same inclusive convention.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "p90",
    "title": "90th percentile · inclusive",
    "category": "Describe",
    "template": "=PERCENTILE.INC({R},0.9)",
    "expected": 25.6,
    "why": "Interpolates the inclusive 90th percentile.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "descriptive"
  },
  {
    "id": "se",
    "title": "Standard error of a mean",
    "category": "Inference",
    "template": "=STDEV.S({R})/SQRT(COUNT({R}))",
    "expected": 2.2451762350716726,
    "why": "For independent observations, estimate SE using sample SD divided by √n.",
    "setup": "Example column A2:A8: 12, 14, 14, 17, 21, 24, 28.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "sampling"
  },
  {
    "id": "standardize",
    "title": "Convert X to a z-score",
    "category": "Probability",
    "template": "=STANDARDIZE(2,1,1)",
    "expected": 1,
    "why": "Subtract the population mean and divide by the population standard deviation.",
    "setup": "X = 2, mean μ = 1, SD σ = 1.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "normal"
  },
  {
    "id": "normal-left",
    "title": "Normal left-tail probability",
    "category": "Probability",
    "template": "=NORM.DIST(2,1,1,TRUE)",
    "expected": 0.8413447460685429,
    "why": "TRUE requests the cumulative probability to the left.",
    "setup": "X ~ Normal with μ = 1 and σ = 1; find P(X ≤ 2).",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "normal"
  },
  {
    "id": "normal-right",
    "title": "Normal right-tail probability",
    "category": "Probability",
    "template": "=NORM.S.DIST(-(2-1)/1,TRUE)",
    "expected": 0.15865525393145707,
    "why": "Use normal symmetry for the right tail; this avoids subtracting a nearly-one cumulative probability.",
    "setup": "μ = 1, σ = 1; find P(X > 2).",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "normal"
  },
  {
    "id": "normal-between",
    "title": "Normal probability between two bounds",
    "category": "Probability",
    "template": "=NORM.DIST(2,1,1,TRUE)-NORM.DIST(-1,1,1,TRUE)",
    "expected": 0.8185946141203637,
    "why": "Subtract the left cumulative probability at the lower bound from that at the upper bound.",
    "setup": "μ = 1, σ = 1; find P(−1 < X < 2).",
    "caution": "This example rounds to 0.8186 at 4 decimals, whereas subtracting printed 4-decimal table cells gives 0.8185. For extreme narrow tails, subtracting similar CDFs can lose precision.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "normal"
  },
  {
    "id": "normal-density",
    "title": "Normal density (not probability)",
    "category": "Probability",
    "template": "=NORM.DIST(1,1,1,FALSE)",
    "expected": 0.3989422804014327,
    "why": "FALSE requests a density height, not a tail probability.",
    "setup": "Density at X = μ = 1 with σ = 1.",
    "caution": "A continuous variable has zero probability at one exact value. The height of its density is not P(X=x).",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "normal"
  },
  {
    "id": "normal-inverse",
    "title": "Normal percentile on the original scale",
    "category": "Probability",
    "template": "=NORM.INV(0.05,0,2)",
    "expected": -3.2897072539029457,
    "why": "Invert a cumulative probability to find an X cutoff.",
    "setup": "5th percentile of a normal variable with mean 0 and SD 2.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "quantiles"
  },
  {
    "id": "z-left",
    "title": "Standard normal cumulative probability",
    "category": "Probability",
    "template": "=NORM.S.DIST(1.96,TRUE)",
    "expected": 0.9750021048517795,
    "why": "The left area at z = 1.96.",
    "setup": "Standard normal mean 0 and SD 1.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "ztable"
  },
  {
    "id": "z-critical",
    "title": "Critical z for central 95%",
    "category": "Probability",
    "template": "=NORM.S.INV(0.975)",
    "expected": 1.959963984540054,
    "why": "A central 95% interval leaves 2.5% in each tail.",
    "setup": "The upper critical point has cumulative probability 0.975.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "quantiles"
  },
  {
    "id": "t-left",
    "title": "Student t left tail",
    "category": "Probability",
    "template": "=T.DIST(2,9,TRUE)",
    "expected": 0.9617235881146495,
    "why": "Cumulative area at an observed t value.",
    "setup": "t = 2 with df = 9.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "tdist"
  },
  {
    "id": "t-right",
    "title": "Student t right tail",
    "category": "Probability",
    "template": "=T.DIST.RT(2,9)",
    "expected": 0.038276411885350504,
    "why": "Upper tail beyond the observed t value.",
    "setup": "t = 2 with df = 9.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "tdist"
  },
  {
    "id": "t-two",
    "title": "Student t two-tailed area",
    "category": "Probability",
    "template": "=T.DIST.2T(ABS(-2),9)",
    "expected": 0.07655282377070101,
    "why": "Combine the tails outside ±|t|.",
    "setup": "Observed t = −2 with df = 9.",
    "caution": "T.DIST.2T expects a nonnegative t argument. ABS handles the sign for two tails; it must not replace a directional one-sided test.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "tdist"
  },
  {
    "id": "t-critical",
    "title": "Two-sided t critical value",
    "category": "Probability",
    "template": "=T.INV.2T(0.05,24)",
    "expected": 2.063898561628026,
    "why": "This function takes TOTAL tail probability α, not 1 − α.",
    "setup": "For a 95% mean interval with n = 25: α = 0.05; df = 24.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "tdist"
  },
  {
    "id": "binomial-exact",
    "title": "Exactly k binomial successes",
    "category": "Probability",
    "template": "=BINOM.DIST(3,10,0.2,FALSE)",
    "expected": 0.20132659199999992,
    "why": "FALSE requests P(X = k), a probability mass for independent identical Bernoulli trials.",
    "setup": "Exactly 3 successes in 10 trials, each with success probability 0.2.",
    "caution": "Use only when trials are independent with the same success probability; not a universal shortcut for clustered or non-identical observations.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": null
  },
  {
    "id": "binomial-cdf",
    "title": "At most k binomial successes",
    "category": "Probability",
    "template": "=BINOM.DIST(3,10,0.2,TRUE)",
    "expected": 0.8791261183999999,
    "why": "TRUE requests the inclusive cumulative probability P(X ≤ k).",
    "setup": "At most 3 successes in 10 independent trials with π = 0.2.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": null
  },
  {
    "id": "poisson-exact",
    "title": "Poisson exact count",
    "category": "Probability",
    "template": "=POISSON.DIST(2,3,FALSE)",
    "expected": 0.22404180765538775,
    "why": "FALSE requests the mass for an exact count.",
    "setup": "P(X = 2) in a Poisson model with mean count 3 per specified interval.",
    "caution": "The mean must refer to the same exposure interval as the count. A Poisson model needs justification; overdispersion or dependence can violate it.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": null
  },
  {
    "id": "poisson-cdf",
    "title": "Poisson cumulative count",
    "category": "Probability",
    "template": "=POISSON.DIST(2,3,TRUE)",
    "expected": 0.42319008112684364,
    "why": "TRUE requests P(X ≤ 2), including counts 0, 1 and 2.",
    "setup": "Poisson mean 3 for the same exposure interval.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": null
  },
  {
    "id": "ci-t",
    "title": "Mean CI margin · sample SD",
    "category": "Inference",
    "template": "=CONFIDENCE.T(0.05,10,25)",
    "expected": 4.127797123256049,
    "why": "Returns the half-width. Add/subtract it from your sample mean; it does NOT return two endpoints.",
    "setup": "α = 0.05, sample s = 10, n = 25. At sample mean 70, the 95% interval is about [65.87220, 74.12780].",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "confidence"
  },
  {
    "id": "ci-z",
    "title": "Mean CI margin · known SD",
    "category": "Inference",
    "template": "=CONFIDENCE.NORM(0.05,10,25)",
    "expected": 3.919927969080108,
    "why": "Normal-reference half-width when the population SD is known.",
    "setup": "α = 0.05, known σ = 10, n = 25. At sample mean 70, interval ≈ [66.08007, 73.91993].",
    "caution": "Do not label a sample SD as a known population SD merely because n is large.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "confidence"
  },
  {
    "id": "paired-test",
    "title": "Paired t-test p-value",
    "category": "Inference",
    "template": "=T.TEST({R},{S},2,1)",
    "expected": 0.0465282322841673,
    "why": "2 tails and type 1 mean a two-sided paired t-test.",
    "setup": "Aligned pairs: A2:A8 = 12,14,14,17,21,24,28; B2:B8 = 11,13,15,16,20,23,27.",
    "caution": "Only for matched pairs with rows correctly aligned. Missing data need a paired strategy; equal sample sizes do not imply pairing.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": null
  },
  {
    "id": "welch-test",
    "title": "Independent Welch t-test p-value",
    "category": "Inference",
    "template": "=T.TEST({R},{S},2,3)",
    "expected": 0.822719419636397,
    "why": "2 tails and type 3 mean unequal-variance independent-group t-test.",
    "setup": "Group A: 12,14,14,17,21,24,28. Independent group B: 11,13,15,16,20,23,27.",
    "caution": "Do not use this on paired observations. Welch is supplementary to the current Fundamentals large-sample z recipe.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "two-means"
  },
  {
    "id": "proportion-ci-se",
    "title": "Estimated SE of a proportion",
    "category": "Inference",
    "template": "=SQRT((120/200)*(1-120/200)/200)",
    "expected": 0.034641016151377546,
    "why": "The Wald interval SE uses the OBSERVED proportion.",
    "setup": "120 successes in 200 independent Bernoulli observations.",
    "caution": "Check observed successes/failures for the interval approximation; this is not the null SE for a hypothesis test.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "proportion-ci"
  },
  {
    "id": "proportion-null-se",
    "title": "Null-based SE for a proportion test",
    "category": "Inference",
    "template": "=SQRT(0.5*(1-0.5)/200)",
    "expected": 0.035355339059327376,
    "why": "Use π₀ under the null, not the observed proportion.",
    "setup": "H₀: π = 0.5; n = 200.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": "proportion-test"
  },
  {
    "id": "delta-cost",
    "title": "Incremental cost · A minus B",
    "category": "Health economics",
    "template": "=14000-10000",
    "expected": 4000,
    "why": "Use the same perspective, currency, price year, horizon and population basis for both options.",
    "setup": "Option A cost = 14000; B cost = 10000; same monetary units.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://www.yhec.co.uk/glossary-term/net-monetary-benefit/",
    "lab": null
  },
  {
    "id": "delta-effect",
    "title": "Incremental health effect",
    "category": "Health economics",
    "template": "=2.4-2",
    "expected": 0.4,
    "why": "Subtract comparator B effects from option A effects; here higher effects are better.",
    "setup": "Option A = 2.4 QALYs; B = 2 QALYs on the same per-person basis.",
    "caution": "Check the input units and missing data. The displayed answer belongs to this fixed teaching example, not to your workbook.",
    "source": "https://www.yhec.co.uk/glossary-term/net-monetary-benefit/",
    "lab": null
  },
  {
    "id": "icer",
    "title": "Incremental cost-effectiveness ratio",
    "category": "Health economics",
    "template": "=IF(2.4=2,\"Undefined: equal effects\",(14000-10000)/(2.4-2))",
    "expected": 10000,
    "why": "ΔCost / ΔEffect, with an explicit check against a zero effect difference.",
    "setup": "A: cost 14000, QALYs 2.4. B: cost 10000, QALYs 2.",
    "caution": "Always identify dominance/quadrant first. A negative ICER alone does not mean good value; the southwest quadrant reverses the usual ratio-threshold direction.",
    "source": "https://www.yhec.co.uk/glossary-term/net-monetary-benefit/",
    "lab": null
  },
  {
    "id": "inmb",
    "title": "Incremental net monetary benefit",
    "category": "Health economics",
    "template": "=20000*(2.4-2)-(14000-10000)",
    "expected": 4000,
    "why": "INMB = λ × ΔEffect − ΔCost. Positive favours A at the chosen threshold in this two-option model.",
    "setup": "Illustrative λ = 20000 monetary units per QALY; no official threshold is assumed.",
    "caution": "An economic comparison is not a clinical instruction or an affordability/budget-impact analysis.",
    "source": "https://www.yhec.co.uk/glossary-term/net-monetary-benefit/",
    "lab": null
  },
  {
    "id": "qaly",
    "title": "Constant-state QALYs",
    "category": "Health economics",
    "template": "=3*0.8",
    "expected": 2.4,
    "why": "Years alive in the state × its utility weight.",
    "setup": "3 years at constant utility 0.8, undiscounted.",
    "caution": "Different time segments must be added separately. This simple calculation does not model survival, state transitions or utility changes.",
    "source": "https://www.yhec.co.uk/glossary-term/quality-adjusted-life-year-qaly/",
    "lab": null
  },
  {
    "id": "discount",
    "title": "Present value of a dated amount",
    "category": "Health economics",
    "template": "=1000/(1+0.03)^5",
    "expected": 862.608784384164,
    "why": "Discount an amount occurring at time t using a rate defined for the same time unit.",
    "setup": "1000 monetary units at the end of year 5; illustrative annual rate 3%.",
    "caution": "The rate is an illustrative assumption, not a policy recommendation. Year 0 amounts are not discounted; no automatic half-cycle correction.",
    "source": "https://support.microsoft.com/en-us/excel/functions/npv-function",
    "lab": null
  },
  {
    "id": "npv",
    "title": "NPV with an initial time-zero flow",
    "category": "Health economics",
    "template": "=-1000+NPV(0.03,400,400,400)",
    "expected": 131.4445419578724,
    "why": "Excel NPV assumes its first listed flow occurs one period from now. Add a time-zero flow separately.",
    "setup": "Pay 1000 at t=0; receive 400 at each year end t=1,2,3; rate 3%.",
    "caution": "NPV is not automatically a health-economic budget-impact result. For irregular dates, a dated discount model or XNPV may be required.",
    "source": "https://support.microsoft.com/en-us/excel/functions/npv-function",
    "lab": null
  },
  {
    "id": "weighted",
    "title": "Probability-weighted expected value",
    "category": "Describe",
    "template": "=SUMPRODUCT({R},{S})/SUM({S})",
    "expected": 20.192,
    "why": "Weighted arithmetic mean: sum(value × weight) divided by sum(weights).",
    "setup": "Example values A = 12,14,14,17,21,24,28; weights B = 11,13,15,16,20,23,27.",
    "caution": "Weights must match the values and sum to a nonzero number. This formula alone does not implement complex-survey inference.",
    "source": "https://support.microsoft.com/en-us/office/sumproduct-function-16753e75-9f68-4874-94ac-4d2145a2fd2e",
    "lab": null
  },
  {
    "id": "correlation",
    "title": "Pearson correlation",
    "category": "Relationships",
    "template": "=CORREL({R},{S})",
    "expected": 0.9922646513702402,
    "why": "Describes linear association between aligned pairs.",
    "setup": "A: 12,14,14,17,21,24,28. Corresponding B: 11,13,15,16,20,23,27.",
    "caution": "No causal conclusion. Check scatter plots, outliers, pairing and nonzero variance; correlation can miss nonlinear patterns.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": null
  },
  {
    "id": "slope",
    "title": "Simple least-squares slope",
    "category": "Relationships",
    "template": "=SLOPE({S},{R})",
    "expected": 0.9568151147098514,
    "why": "Returns the slope of Y on X with an intercept; known Y values come FIRST.",
    "setup": "X in A: 12,14,14,17,21,24,28; Y in B: 11,13,15,16,20,23,27.",
    "caution": "A fitted slope is not a causal effect. The formula does not test linear-model assumptions or handle confounding.",
    "source": "https://support.microsoft.com/en-us/excel/statistical-functions-reference",
    "lab": null
  }
];
const byId=new Map(recipes.map(r=>[r.id,r]));
const categories=[...new Set(recipes.map(r=>r.category))];
function validRange(text){
  if(typeof text!=='string'||text.length>40)return false;
  const p=text.toUpperCase().split(':');if(p.length>2)return false;
  const cells=p.map(s=>/^\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})$/.exec(s));if(cells.some(x=>!x))return false;
  const values=cells.map(m=>[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0));
  if(values.some(n=>n>16384)||cells.some(m=>Number(m[2])>1048576))return false;
  return p.length===1||(values[0]<=values[1]&&Number(cells[0][2])<=Number(cells[1][2]));
}
function formatFormula(template,{range='A2:A8',second='B2:B8',separator=',',decimal='.'}={}){
  if(![',',';'].includes(separator)||!['.',','].includes(decimal)||decimal===','&&separator===',')throw new Error('Decimal comma requires semicolon argument separators.');
  if(template.includes('{R}')&&!validRange(range)||template.includes('{S}')&&!validRange(second))throw new Error('Use an A1-style cell or range (for example $A$2:$A$8). Sheet names, external links and expressions are not accepted here.');
  const expr=template.replaceAll('{R}',range.toUpperCase()).replaceAll('{S}',second.toUpperCase());
  // Split quoted Excel text from syntax: preserve literal commas and decimal points in strings.
  return expr.split(/("(?:[^"]|"")*")/g).map((part,i)=>{
    if(i%2)return part;
    return part.replace(/\d+\.\d+|,/g,token=>token===','?separator:decimal===','?token.replace('.',','):token);
  }).join('');
}
function search(q='',category='all'){
  const words=String(q).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return recipes.filter(r=>(category==='all'||r.category===category)&&words.every(w=>[r.title,r.template,r.why,r.id].join(' ').toLowerCase().includes(w)));
}
return Object.freeze({recipes,byId,categories,validRange,formatFormula,search});
});
