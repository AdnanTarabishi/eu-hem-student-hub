// Original hypothetical practice forms for the existing Statistics mock renderer.
// These are student-created examples, not the teacher's mock paper or real patient data.
// Numerical answers use full-precision t / Normal calculations; tolerances allow stated rounding.
(function (root) {
  'use strict';
  const forms = [
  {
    "id": "clinic-b",
    "title": "Form B — Waiting times and patient preferences",
    "interpretations": [
      {
        "title": "Reading a one-mean blood-pressure result",
        "html": "<p><strong>Original hypothetical example.</strong> A random sample of 64 independent eligible adult patients at a clinic has mean systolic blood pressure 128 mmHg and adjusted SD 16 mmHg. Assume a Normal population. The report tests H₀: μ=130 mmHg against Hₐ: μ≠130 mmHg.</p><div class=\"table-wrap\"><table><caption>One-sample t output; reference distribution t with 63 degrees of freedom</caption><thead><tr><th scope=\"col\">Mean (mmHg)</th><th scope=\"col\">SE (mmHg)</th><th scope=\"col\">Observed t</th><th scope=\"col\">Two-sided p</th><th scope=\"col\">95% t CI (mmHg)</th></tr></thead><tbody><tr><td>128</td><td>2</td><td>-1.000</td><td>0.321136</td><td>[124.003, 131.997]</td></tr></tbody></table></div><p>Interpret the estimate relative to 130 mmHg, the decision at 5%, and the confidence interval. Explain why this does not prove that the population mean is exactly 130 mmHg.</p>",
        "answer": "The population mean systolic pressure is estimated as 128 mmHg, 2 mmHg below the benchmark. Do not reject H₀ at 5% because p≈0.321136>0.05; the 95% interval [124.003, 131.997] mmHg includes 130. Under the stated sampling and Normal assumptions, about 95% of intervals produced by this procedure in repeated samples would cover the fixed population mean. Failure to reject is not proof of equality or equivalence, and the interval is not a range containing 95% of individual patients' pressures.",
        "rubric": [
          "Identifies the population mean, the 128 mmHg estimate and its 2 mmHg direction below the benchmark",
          "Does not reject at 5%, using the p-value or the fact that the matching interval includes 130",
          "Explains repeated-sampling coverage and states that non-rejection does not prove equality or describe individual pressures"
        ]
      },
      {
        "title": "Interpreting a patient-reminder preference interval",
        "html": "<p><strong>Original hypothetical example.</strong> A random sample of 500 independent eligible patients includes 340 who prefer text-message appointment reminders. The report uses the large-sample Wald interval for the population proportion.</p><div class=\"table-wrap\"><table><caption>Proportion output; the observed outcome counts are 340 and 160</caption><thead><tr><th scope=\"col\">Observed proportion</th><th scope=\"col\">95% Wald CI</th><th scope=\"col\">Confidence level</th></tr></thead><tbody><tr><td>0.68</td><td>[0.639, 0.721]</td><td>95%</td></tr></tbody></table></div><p>Identify the population quantity and interpret the endpoints as percentages. Explain the confidence level and give one claim the interval cannot support.</p>",
        "answer": "The target is the proportion of eligible patients who prefer text reminders, estimated as 68%. The approximate interval is 63.9%–72.1%. In repeated random sampling under the assumptions, about 95% of intervals constructed by this procedure would contain the fixed population proportion. This realised interval does not assign a frequentist 95% probability to that fixed parameter and does not say that 95% of patients prefer reminders. An interval also does not remove bias from an unrepresentative sample.",
        "rubric": [
          "Identifies the population proportion and interprets 68% with bounds of about 63.9%–72.1%",
          "Explains confidence through repeated-sampling coverage of the fixed population proportion",
          "Rejects an individual-level or posterior-probability claim, or explains that the interval cannot correct sampling bias"
        ]
      }
    ],
    "applied": [
      {
        "title": "A clinic waiting-time mean interval and test",
        "html": "<p><strong>Original hypothetical example.</strong> A clinic samples 10 patients to study the population mean waiting time before an appointment. The measurements in minutes are <strong>14, 16, 15, 18, 17, 16, 19, 15, 18, 17</strong>.</p><p>Assume independent random observations from a Normal population with unknown variance. Paste the values into Excel cells A2:A11. Calculate the mean, a 95% t confidence interval and the observed statistic for H₀: μ=18 minutes against Hₐ: μ≠18 minutes, at 5%. Keep full precision during calculations; report the mean and interval endpoints to at least two decimal places and t to three. Write the assumptions, hypotheses and a population-level conclusion.</p>",
        "fields": [
          [
            "Sample mean (minutes)",
            16.5,
            0.01
          ],
          [
            "95% CI lower endpoint (minutes)",
            15.368921418600898,
            0.02
          ],
          [
            "95% CI upper endpoint (minutes)",
            17.631078581399102,
            0.02
          ],
          [
            "Observed t statistic",
            -3.0,
            0.005
          ]
        ],
        "answer": "n=10; mean=16.50000; adjusted SD=1.58114; SE=0.50000; df=9; positive 95% t cutoff≈2.26216. The interval is [15.36892, 17.63108] minutes. t=(16.5−18)/0.50000≈-3.00000; two-sided p≈0.014956. Reject H₀ at 5%; the interval excludes 18. The data provide evidence that the population mean differs from 18 minutes; the observed mean is below the benchmark. These statements depend on the independent Normal-sample model, and the interval estimates the population mean, not individual measurements.",
        "excel": "Paste the data in A2:A11. B2: =AVERAGE(A2:A11); B3: =STDEV.S(A2:A11)/SQRT(COUNT(A2:A11)); B4: =T.INV(0.975,9). Lower: =B2-B4*B3; upper: =B2+B4*B3; t: =(B2-18)/B3; p: =T.DIST.2T(ABS((B2-18)/B3),9).",
        "rubric": "States the two-sided hypotheses and independent Normal/unknown-variance model, then rejects at 5% with a population-mean conclusion; interprets the interval as uncertainty about the population mean"
      },
      {
        "title": "A patient-portal proportion test",
        "html": "<p><strong>Original hypothetical example.</strong> Success means that an eligible adult used the clinic patient portal during the previous month. A random sample of <strong>180 independent eligible adults</strong> includes <strong>81 successes</strong>.</p><p>Test H₀: π=0.50 against Hₐ: π≠0.50 at 5%, using the course Normal approximation. Check both expected counts under H₀, calculate the four quantities below and write a population-level conclusion. Use π₀ in the test standard error. Keep full precision during calculations; report SE and p to at least four decimal places and z to three.</p>",
        "fields": [
          [
            "Observed proportion p̂",
            0.45,
            0.0005
          ],
          [
            "Null-based standard error",
            0.037267799624996496,
            5e-05
          ],
          [
            "Observed z statistic",
            -1.3416407864998734,
            0.005
          ],
          [
            "Two-sided p-value",
            0.17971249487899998,
            0.0001
          ]
        ],
        "answer": "p̂=81/180=0.45000. Under H₀, expected successes=90 and failures=90; both exceed 5. SE₀=√(0.5×0.5/180)≈0.03726780. z≈-1.341641; two-sided p≈0.17971249. Do not reject H₀ at 5%. The data do not provide sufficient evidence at 5% that the population success proportion differs from 0.50; the observed estimate is below that value. Non-rejection does not prove the null. The conclusion relies on suitable random sampling, independence and the Normal approximation; it does not establish causation.",
        "excel": "B2: =81/180; B3: =SQRT(0.5*(1-0.5)/180); B4: =(B2-0.5)/B3; two-sided p: =2*NORM.S.DIST(-ABS(B4),TRUE).",
        "rubric": "Checks the expected null counts, uses the null-based SE and two-sided alternative, then does not reject at 5% with a population-proportion conclusion and a suitable independence/sampling qualification"
      }
    ]
  },
  {
    "id": "clinic-c",
    "title": "Form C — Laboratory times and follow-up completion",
    "interpretations": [
      {
        "title": "Reading a one-mean observation-time result",
        "html": "<p><strong>Original hypothetical example.</strong> A service samples 36 independent eligible patients to estimate mean observation time before discharge. Assume a Normal population with unknown variance. The sample mean is 7.8 hours and adjusted SD is 2.4 hours. The report tests H₀: μ=6.8 hours against Hₐ: μ≠6.8 hours.</p><div class=\"table-wrap\"><table><caption>One-sample t output; reference distribution t with 35 degrees of freedom</caption><thead><tr><th scope=\"col\">Mean (hours)</th><th scope=\"col\">SE (hours)</th><th scope=\"col\">Observed t</th><th scope=\"col\">Two-sided p</th><th scope=\"col\">95% t CI (hours)</th></tr></thead><tbody><tr><td>7.8</td><td>0.4</td><td>2.500</td><td>0.017256</td><td>[6.988, 8.612]</td></tr></tbody></table></div><p>Interpret the direction and decision at 5%, and explain the confidence interval. Can statistical significance alone establish clinical importance or a causal effect?</p>",
        "answer": "The population mean observation time is estimated as 7.8 hours, 1.0 hour above the null benchmark. Reject H₀ at 5% because p≈0.017256<0.05; the matching 95% interval [6.988, 8.612] hours excludes 6.8. Confidence refers to about 95% coverage by this interval procedure over repeated suitable samples, not to 95% of patients' observation times. Statistical significance alone does not establish that the difference is clinically important or caused by a particular service policy.",
        "rubric": [
          "Names the population mean and interprets the estimated 1.0-hour direction above the benchmark",
          "Rejects at 5% and uses the p-value or interval exclusion of 6.8 consistently",
          "Explains the population-mean interval and repeated-sampling confidence, while distinguishing significance from clinical importance or causation"
        ]
      },
      {
        "title": "Interpreting a video-follow-up preference interval",
        "html": "<p><strong>Original hypothetical example.</strong> In a random sample of 320 independent eligible patients, 176 prefer video follow-up appointments. A report supplies a 95% Wald interval for the population proportion.</p><div class=\"table-wrap\"><table><caption>Proportion output; the observed outcome counts are 176 and 144</caption><thead><tr><th scope=\"col\">Observed proportion</th><th scope=\"col\">95% Wald CI</th><th scope=\"col\">Confidence level</th></tr></thead><tbody><tr><td>0.55</td><td>[0.495, 0.605]</td><td>95%</td></tr></tbody></table></div><p>Interpret the estimate and interval, and explain the confidence level. Does the point estimate give exact knowledge of the population preference rate?</p>",
        "answer": "The estimated population proportion preferring video follow-up is 55%, with an approximate 95% interval of 49.5%–60.5%. The interval includes population rates both below and above 50%; the sample estimate alone is not exact knowledge of the population rate. About 95% of intervals generated by this procedure in repeated suitable samples would cover the fixed population proportion. The interval does not describe 95% of individuals and is not a frequentist probability statement that this fixed parameter lies in these already observed bounds.",
        "rubric": [
          "Identifies the population proportion and reports 55% with bounds of about 49.5%–60.5%",
          "Explains the 95% level as repeated-sampling coverage under the sampling and approximation assumptions",
          "Recognises remaining uncertainty, including values on both sides of 50%, and avoids an individual-level or fixed-parameter probability interpretation"
        ]
      }
    ],
    "applied": [
      {
        "title": "A laboratory turnaround-time interval and test",
        "html": "<p><strong>Original hypothetical example.</strong> A laboratory samples 12 independent routine tests to study the population mean turnaround time. The measurements in minutes are <strong>42, 38, 45, 40, 44, 41, 39, 43, 46, 37, 42, 41</strong>.</p><p>Assume independent random observations from a Normal population with unknown variance. Paste the values into Excel cells A2:A13. Calculate the mean, a 95% t confidence interval and the observed statistic for H₀: μ=40 minutes against Hₐ: μ≠40 minutes, at 5%. Keep full precision during calculations; report the mean and interval endpoints to at least two decimal places and t to three. Write the assumptions, hypotheses and a population-level conclusion.</p>",
        "fields": [
          [
            "Sample mean (minutes)",
            41.5,
            0.01
          ],
          [
            "95% CI lower endpoint (minutes)",
            39.75470359159705,
            0.02
          ],
          [
            "95% CI upper endpoint (minutes)",
            43.24529640840295,
            0.02
          ],
          [
            "Observed t statistic",
            1.8916430035849912,
            0.005
          ]
        ],
        "answer": "n=12; mean=41.50000; adjusted SD=2.74690; SE=0.79296; df=11; positive 95% t cutoff≈2.20099. The interval is [39.75470, 43.24530] minutes. t=(41.5−40)/0.79296≈1.89164; two-sided p≈0.085146. Do not reject H₀ at 5%; the interval includes 40. The data do not provide sufficient evidence at 5% that the population mean differs from 40 minutes; the observed mean is above the benchmark. Non-rejection does not prove equality. These statements depend on the independent Normal-sample model, and the interval estimates the population mean, not individual measurements.",
        "excel": "Paste the data in A2:A13. B2: =AVERAGE(A2:A13); B3: =STDEV.S(A2:A13)/SQRT(COUNT(A2:A13)); B4: =T.INV(0.975,11). Lower: =B2-B4*B3; upper: =B2+B4*B3; t: =(B2-40)/B3; p: =T.DIST.2T(ABS((B2-40)/B3),11).",
        "rubric": "States the two-sided hypotheses and independent Normal/unknown-variance model, then does not reject at 5% with a population-mean conclusion; interprets the interval as uncertainty about the population mean and does not treat non-rejection as proof of equality"
      },
      {
        "title": "A follow-up completion proportion test",
        "html": "<p><strong>Original hypothetical example.</strong> Success means that an eligible adult completed the scheduled follow-up within seven days. A random sample of <strong>240 independent eligible adults</strong> includes <strong>156 successes</strong>.</p><p>Test H₀: π=0.55 against Hₐ: π≠0.55 at 5%, using the course Normal approximation. Check both expected counts under H₀, calculate the four quantities below and write a population-level conclusion. Use π₀ in the test standard error. Keep full precision during calculations; report SE and p to at least four decimal places and z to three.</p>",
        "fields": [
          [
            "Observed proportion p̂",
            0.65,
            0.0005
          ],
          [
            "Null-based standard error",
            0.032113081446662826,
            5e-05
          ],
          [
            "Observed z statistic",
            3.1139957766460906,
            0.005
          ],
          [
            "Two-sided p-value",
            0.0018457213176962756,
            0.0001
          ]
        ],
        "answer": "p̂=156/240=0.65000. Under H₀, expected successes=132 and failures=108; both exceed 5. SE₀=√(0.55×0.45/240)≈0.03211308. z≈3.113996; two-sided p≈0.00184572. Reject H₀ at 5%. The data provide evidence that the population success proportion differs from 0.55; the observed estimate is above that value. The conclusion relies on suitable random sampling, independence and the Normal approximation; it does not establish causation.",
        "excel": "B2: =156/240; B3: =SQRT(0.55*(1-0.55)/240); B4: =(B2-0.55)/B3; two-sided p: =2*NORM.S.DIST(-ABS(B4),TRUE).",
        "rubric": "Checks the expected null counts, uses the null-based SE and two-sided alternative, then rejects at 5% with a population-proportion conclusion and a suitable independence/sampling qualification"
      }
    ]
  }
];

  // Keep this data-only file usable by both the browser and focused Node checks.
  if (typeof module !== 'undefined' && module.exports) module.exports = forms;
  else root.FundStudyMockForms = forms;
})(typeof window !== 'undefined' ? window : globalThis);
