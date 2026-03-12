import shutil
from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from shapely.geometry import box

from backend.Rainfall_csv import rainfall
from backend.nc_to_rainfall_extremes import extremes
from backend.extremes_point import extremes_point
from backend.Extreme_significance_Test import statistical_test
from backend.Extreme_Plots import plots
from backend.Return_Period_Probability import return_period_prob
from backend.daily_raster import download_raster_daily_range
from backend.monthly_raster import download_raster_monthly_range
from backend.yearly_raster import download_raster_yearly_range
import pandas as pd
import os
import tempfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder='frontend/templates')

@app.route('/', methods=['GET'])
def main():
    return render_template('home.html')

@app.route('/precipitation/', methods=['GET'])
def precipitation():
    return render_template('main.html')

@app.route('/form', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        function = request.form['function']
        start_year = int(request.form['start_year'])
        end_year = int(request.form['end_year'])
        input_type = request.form.get('input_type', 'bbox')
        bbox = None
        point = None
        if input_type == 'bbox':
            bbox_str = request.form.get('bbox', '')
            if bbox_str:
                bbox_vals = [float(x) for x in bbox_str.split(',')]
                if len(bbox_vals) == 4:
                    bbox = box(*bbox_vals)
        elif input_type == 'point':
            point_str = request.form.get('point', '')
            if point_str:
                point_vals = [float(x) for x in point_str.split(',')]
                if len(point_vals) == 2:
                    point = tuple(point_vals)
        start_date = request.form['start_date']
        end_date = request.form['end_date']
        if function == 'rainfall_csv':
            if bbox:
                rainfall(start_year, end_year, bbox)
                return send_file(os.path.join(BASE_DIR, 'daily_rainfall.csv'), as_attachment=True)
            else:
                return "Bounding box required for rainfall CSV."
        elif function == 'extremes':
            csv_path = os.path.join(BASE_DIR, 'index_values.csv')

            if os.path.exists(csv_path):
                os.remove(csv_path)
            
            if bbox:
                extremes(start_year, end_year, bbox)
                return send_file(os.path.join(BASE_DIR, 'index_values.csv'), as_attachment=True)
            elif point:
                extremes_point(start_year, end_year, point[0], point[1])
                return send_file(os.path.join(BASE_DIR, 'index_values.csv'), as_attachment=True)
            else:
                return "Please provide either a bounding box or a point."
        elif function == 'statistical_test':
            statistical_test()
            return send_file(os.path.join(BASE_DIR, 'results_5.csv'), as_attachment=True)
        elif function == 'plots':
            plots()
            return "Plots generated successfully"
        elif function == 'return_period_prob':
            return_period_prob()
            return send_file('return_periods_and_probabilities_with_labels.csv', as_attachment=True)
        elif function == 'daily_raster':
            if bbox:
                download_raster_daily_range(bbox, start_date, end_date)
                return "Raster downloaded successfully"
            else:
                return "Bounding box required for raster download."
        elif function == 'monthly_raster':
            if bbox:
                download_raster_monthly_range(bbox, start_date, end_date)
                return "Raster downloaded successfully"
            else:
                return "Bounding box required for raster download."
        elif function == 'yearly_raster':
            if bbox:
                download_raster_yearly_range(bbox, start_date, end_date)
                return "Raster downloaded successfully"
            else:
                return "Bounding box required for raster download."
    return render_template('index.html')

@app.route('/api/extremes', methods=['POST'])
def api_extremes():

    # 🔥 REMOVE OLD FILE FIRST
    csv_path = os.path.join(BASE_DIR, 'index_values.csv')

    if os.path.exists(csv_path):
        os.remove(csv_path)


    data = request.json
    start_year = int(data.get('start_year'))
    end_year = int(data.get('end_year'))
    input_type = data.get('input_type', 'bbox')
    result = {}
    if input_type == 'bbox':
        bbox_vals = data.get('bbox', [])
        if len(bbox_vals) == 4:
            bbox = box(*bbox_vals)
            extremes(start_year, end_year, bbox)
            csv_path = os.path.join(BASE_DIR, 'index_values.csv')            
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path, index_col=0)
                result = df.iloc[[-1]].to_dict(orient='records')
    elif input_type == 'point':
        point_vals = data.get('point', [])
        if len(point_vals) == 2:
            extremes_point(start_year, end_year, point_vals[0], point_vals[1])
            csv_path = os.path.join(BASE_DIR, 'index_values.csv')
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path, index_col=0)
                result = df.iloc[[-1]].to_dict(orient='records')
    return jsonify(result)

@app.route('/download/index_values.csv')
def download_index_values():
    # Move the file to a temp directory before sending
    import shutil
    temp_dir = tempfile.gettempdir()
    csv_path = os.path.join(BASE_DIR, 'index_values.csv')

    temp_path = os.path.join(temp_dir, 'index_values.csv')
    shutil.copyfile(csv_path, temp_path)

    return send_file(temp_path, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)