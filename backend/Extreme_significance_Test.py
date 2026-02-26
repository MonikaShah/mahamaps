import pandas as pd
import numpy as np
from scipy.stats import norm
import os


def statistical_test():
        
    df = pd.read_csv('index_values.csv', index_col=0)

    units = {
        'RX1day': 'mm',
        'RX5day': 'mm',
        'R95p': 'mm',
        'R99p': 'mm',
        'R10mm': 'days',
        'R20mm': 'days',
        'R65mm': 'days',
        'R115mm': 'days',
        'R205mm': 'days',
        'CDD': 'days',
        'CWD': 'days'
    }

    results = []

    for column in df.columns:
        data = df[column]
        data = data.reset_index(drop=True)
        
        def mk_test(data):
            n = len(data)
            s = 0
            for k in range(n - 1):
                for j in range(k + 1, n):
                    s += np.sign(data[j] - data[k])
            var_s = (n * (n - 1) * (2 * n + 5)) / 18
            if s > 0:
                z = (s - 1) / np.sqrt(var_s)
            elif s < 0:
                z = (s + 1) / np.sqrt(var_s)
            else:
                z = 0
            p = 2 * (1 - norm.cdf(abs(z)))
            return z, p

        n = len(data)
        slopes = [np.nan]
        for i in range(1, n):
            slopes.append((data[i] - data[0]) / i)

        z, p = mk_test(data)

        if p <= 0.05:
            trend = "Significant Trend"
        else:
            trend = "No Significant Trend"

        sensitivity = ""
        if abs(z) > 2.33:
            sensitivity = "High sensitivity"
        elif 1.96 <= abs(z) <= 2.33:
            sensitivity = "Medium sensitivity"
        else:
            sensitivity = "Low sensitivity"

        robustness = ""
        if p <= 0.01:
            robustness = "High robustness"
        elif 0.01 < p <= 0.05:
            robustness = "Medium robustness"
        else:
            robustness = "Low robustness"

        result = {
            'Index': column,
            'Unit': units[column],
            'Mann-Kendall Trend': trend,
            'Sen\'s Slope': f'{slopes[-1]:.3f}',
            'P-Value': f'{p:.4f}',
            'Z-Value': f'{z:.2f}',
            'Sensitivity': sensitivity,
            'Robustness': robustness
        }
        
        desc = data.describe()
        for key, value in desc.items():
            if key in ['mean', 'std', 'min', '25%', '50%', '75%', 'max']:
                result[key] = f'{value:.2f}'
            else:
                result[key] = value
        
        results.append(result)

    results_df = pd.DataFrame(results)
    csv_path = 'results_5.csv'
    write_header = not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0
    results_df.to_csv(csv_path, mode='a', header=write_header, index=False)
