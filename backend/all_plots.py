import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import statsmodels.api as sm
import matplotlib.ticker as ticker
from statsmodels.formula.api import rlm
from sklearn.linear_model import ElasticNet


def plots():
    df = pd.read_csv('index_values.csv', index_col=0)
    plt.style.use('seaborn-darkgrid')

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

    sen = [0.067, 0.257, 0.024, 0.068, -0.131, -0.074, -0.008, 0, 0, 0.156, -0.189]
    k = 0

    fig, axes = plt.subplots(nrows=2, ncols=5, figsize=(30, 10))

    for i, column in enumerate(df.columns):

        row = i // 5
        col = i % 5
        ax = axes[row, col]

        ax.plot(df.index, df[column], label=column, linewidth=2)

        X = df.index.values
        model = np.polyfit(X, df[column], 1)
        trend = np.polyval(model, X)
        ax.plot(df.index, trend, label='Linear Regression Trend', linestyle='--', color='red')

        X_ols = sm.add_constant(X)
        model_gls = sm.GLS(df[column], X_ols)
        results_gls = model_gls.fit()
        trend_gls = results_gls.predict(X_ols)
        ax.plot(df.index, trend_gls, label='GLS Trend', linestyle='-.', color='green')

        df_reset = df.reset_index(drop=True)
        n = len(df_reset[column])
        slopes = [np.nan]
        for j in range(1, n):
            if df_reset[column][j] == 0 or np.isnan(df_reset[column][j]) or np.isinf(df_reset[column][j]):
                slopes.append(np.nan)
            else:
                slopes.append((df_reset[column][j] - df_reset[column][0]) / j)
        ax.plot(df.index, slopes, linestyle='-', color='orange')

        slope = sen[k]
        k += 1
        stats_text = (f'Sen\'s Slope: {slopes[-1]:.2f}, p-value: {slope:.4f} (MK Test)\n'
                      f'GLS Slope: {results_gls.params[1]:.2f}, p-value: {results_gls.pvalues[1]:.4f}')

        if results_gls.centered_tss == 0:
            r_squared = np.nan
        else:
            r_squared = results_gls.rsquared

        stats_text += f', R-squared: {r_squared:.2f}\n'

        ax.text(0.05, 0.95, stats_text, transform=ax.transAxes, fontsize=8, verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.5))

        ax.legend(loc='upper right', frameon=False, fontsize=8)
        ax.set_xlabel('Year', fontsize=12, fontweight='bold')
        ax.set_ylabel(f'{column} ({units[column]})', fontsize=12, fontweight='bold')

        ax.grid(True, linestyle=':', color='black')
        ax.set_facecolor('#f0f0f0')

    plt.tight_layout(pad=3.0)
    plt.savefig('time_series_plots.png', bbox_inches='tight')

plots()