import pandas as pd
import numpy as np
from scipy.stats import genpareto as gpd


def return_period_prob():
        

    data = pd.read_csv('index_values.csv', index_col=0)
    thresholds = {
        'RX1day': 72.23,
        'RX5day': 194.22,
        'R95p': 17.92,
        'R99p': 38.72,
        'R10mm': 40.0,
        'R20mm': 16.0,
        'R65mm': 1.0,
        'R115mm': 0.0,
        'R205mm': 0.0,
        'CDD': 97.0,
        'CWD': 44.5
    }


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

    result = {}
    for col in data.columns:
        if col in thresholds:
            threshold = thresholds[col]
            exceedances = data[col][data[col] > threshold]
            if len(exceedances) > 0:
                params = gpd.fit(exceedances - threshold)
                exceedance_probability = round(len(exceedances) / len(data), 3)
                return_period = round(1 / exceedance_probability, 2)
                label = ''
                if return_period >= 100:
                    label = 'Very exceptional'
                elif 50 <= return_period < 100:
                    label = 'Exceptional'
                elif 10 <= return_period < 50:
                    label = 'Severely abnormal'
                elif 5 <= return_period < 10:
                    label = 'Abnormal'
                else:
                    label = 'Normal'
                result[col] = {
                    'Parameter': col,
                    'Unit': units[col],
                    'Threshold': threshold,
                    'Exceedance Probability': exceedance_probability,
                    'Return Period': return_period,
                    'Label': label
                }
            else:
                result[col] = {
                    'Parameter': col,
                    'Unit': units[col],
                    'Threshold': threshold,
                    'Exceedance Probability': 0,
                    'Return Period': np.inf,
                    'Label': 'No exceedances'
                }

    result_df = pd.DataFrame(result).T

    csv_path = 'return_periods_and_probabilities_with_labels.csv'
    write_header = not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0
    result_df.to_csv(csv_path, mode='a', header=write_header)
