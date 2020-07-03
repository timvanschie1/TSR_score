/**
 * Used libraries:
 * papa = Papa Parse. See https://www.papaparse.com/
 * fuzzball = JavaScript port of the fuzzywuzzy Python library. See https://github.com/nol13/fuzzball.js/
 * saveAs = FileSaver.js. See https://github.com/eligrey/FileSaver.js/
 */

function handleFileLoaded(e) {
    const csvData = e.target.result;

    /** Convert CSV file to JSON format we can work with in JavaScript
     * The function addFuzzyCalculations is called when conversion is completed with the result as the argument **/
    Papa.parse(csvData, {
        complete: addFuzzyCalculations
    });
}

function addFuzzyCalculations(parsedResult) {
    /** jsonData is now an array of arrays ("rows") **/
    const jsonData = parsedResult.data;

    /** Loop over the results data with the map function. For every row: do modifications. The map function returns
     * the modified array of arrays to dataWithFuzzyCalculations. **/
    const dataWithFuzzyCalculations = jsonData.map((row, i) => {
        if (i === 0) {
            /** For the first row, add "Score" as the last array item ("column") **/
            row.push('Score');
        } else {
            /** Otherwise, do fuzzball magic with the data in the second and third cell (response and model cells) and add
             * that data as the last array item **/
            const response = row[1];
            const model = row[2];
            const fuzzyCalculation = fuzzball.token_sort_ratio(model, response);

            row.push(fuzzyCalculation);
        }

        /** Return the modified array ("row") to the map method. It uses it to return the modified array of arrays to
         * dataWithFuzzyCalculations **/
        return row;
    });

    convertToCsvAndSaveFile(dataWithFuzzyCalculations);
}

function convertToCsvAndSaveFile(jsonData) {
    const csvData = Papa.unparse(jsonData, {delimiter: ";"});
    const blob = new Blob([csvData], {
        type: "text/plain;charset=utf-8;",
    });
    saveAs(blob, "output.csv");
}

function handleInputChange(e) {
    const noFile = e.target.files.length === 0;
    if (noFile) {
        return;
    }

    const file = e.target.files[0];

    /** See https://developer.mozilla.org/en-US/docs/Web/API/FileReader **/
    const reader = new FileReader();
    reader.onload = handleFileLoaded;
    /** After the file is loaded via readAsText (method of FileReader API), the function handleFileLoaded is called **/
    reader.readAsText(file);
}

/** Get the fileInput HTML element **/
const fileInput = document.getElementById('fileInput');

/** When the file is selected, call handleFileInputChange **/
fileInput.addEventListener('change', handleInputChange);
