import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import statsmodels.api as sm
import matplotlib.ticker as ticker
from statsmodels.formula.api import rlm
from sklearn.linear_model import ElasticNet


def plots():
    df = pd.read_csv('index_values.csv', index_col=0)
    plt.style.use('ggplot')

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

    sen = [0,0,0,0,0,0,0,0,0.3926,0.7229,0.0001]
    k=0
    for column in df.columns:
        fig, ax = plt.subplots(figsize=(18, 10))
        ax.plot(df.index, df[column], label=column, color='blue', linewidth=2)
        X = df.index.values
        model = np.polyfit(X, df[column], 1)
        trend = np.polyval(model, X)
        ax.plot(df.index, trend, label='Linear Regression Trend', linestyle='--', color='red')
        X_ols = sm.add_constant(X)
        model_ols = sm.OLS(df[column], X_ols)
        results_ols = model_ols.fit()
        trend_ols = results_ols.predict(X_ols)
        ax.plot(df.index, trend_ols, label='OLS Trend', linestyle='-', color='purple')
        model_gls = sm.GLS(df[column], X_ols)
        results_gls = model_gls.fit()
        trend_gls = results_gls.predict(X_ols)
        ax.plot(df.index, trend_gls, label='GLS Trend', linestyle='-.', color='green')
        elastic_net = ElasticNet(alpha=0.1, l1_ratio=0.5)
        elastic_net.fit(X_ols, df[column])
        trend_en = elastic_net.predict(X_ols)
        ax.plot(df.index, trend_en, label='Elastic Net Trend', linestyle=':', color='magenta')
        df_reset = df.reset_index(drop=True)
        n = len(df_reset[column])
        slopes = [np.nan]
        for i in range(1, n):
            slopes.append((df_reset[column][i] - df_reset[column][0]) / i)
        ax.plot(df.index, slopes, label="Sen's Slope", linestyle='-', color='orange')
        ax.legend(loc='center left', bbox_to_anchor=(1, 0.5))
        ax.set_xlabel('Year', fontsize=12, fontweight='bold')
        ax.set_ylabel(f'{column} ({units[column]})', fontsize=12, fontweight='bold')
        ax.set_title(f'Time Series Plot of Warana River Basin with Trend Analysis for {column} ({units[column]})', fontsize=14, fontweight='bold')
        slope = sen[k]
        # Use correct keys for pvalues, params, and coef_
        pval_key = results_ols.pvalues.index[-1]
        param_key = results_ols.params.index[-1]
        gls_param_key = results_gls.params.index[-1]
        gls_pval_key = results_gls.pvalues.index[-1]
        en_coef = elastic_net.coef_[-1] if hasattr(elastic_net, 'coef_') else 0
        stats_text = (f'Linear Regression Slope: {model[0]:.2f}, p-value: {results_ols.pvalues[pval_key]:.4f}, R-squared:{np.corrcoef(X, df[column])[0, 1]**2:.2f}\n'
                      f'OLS Slope: {results_ols.params[param_key]:.2f}, p-value: {results_ols.pvalues[pval_key]:.4f}, R-squared: {results_ols.rsquared:.2f}\n'
                      f'GLS Slope: {results_gls.params[gls_param_key]:.2f}, p-value: {results_gls.pvalues[gls_pval_key]:.4f}, R-squared: {results_gls.rsquared:.2f}\n'
                      f'Elastic Net Slope: {en_coef:.2f}\n'
                      f"Sen's Slope: {slopes[-1]:.2f}, p-value: {slope:.4f} (MK Test)")
        k = k+1
        ax.text(0.05, 0.95, stats_text, transform=ax.transAxes, fontsize=14, verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.5))
        xmin, xmax = ax.get_xlim()
        ax.set_xlim(xmin, xmax+5)
        ax.yaxis.set_major_locator(ticker.MaxNLocator(10))
        ax.grid(True, linestyle=':', color='black')
        ax.set_facecolor('#f0f0f0')
        plt.tight_layout()
        plt.savefig(f'{column}_time_series_plot.png', bbox_inches='tight')
