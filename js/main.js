/**
 * Used libraries:
 * papa = Papa Parse. See https://www.papaparse.com/
 * fuzzball = JavaScript port of the fuzzywuzzy Python library. See https://github.com/nol13/fuzzball.js/
 * saveAs = FileSaver.js. See https://github.com/eligrey/FileSaver.js/
 */

const fileInputEl = document.getElementById('fileInput');
const separatorSelectEl = document.querySelector('#separatorSelect')
const separatorErrorEl = document.querySelector('#separatorSelectError');
const errorMessageEl = document.querySelector('#errorMessage');
const errorMessageContentEl = errorMessageEl.querySelector(".js-message-content");
const agreeMessageEl = document.querySelector('#agreeMessage');
const agreeMessageContentEl = agreeMessageEl.querySelector(".js-message-content");
const agreeMessageAgreeButton = document.querySelector("#agreeMessageAgreeButton");
const agreeMessageCancelButton = document.querySelector("#agreeMessageCancelButton");
const closeMessageButtons = document.querySelectorAll('.js-close-message');

/** Separator is made global, so it can easily be changed and used at different places. **/
let separator = "";

function handleFileLoaded(e) {
    const csvData = e.target.result;

    /** Convert CSV file to JSON format we can work with in JavaScript
     * The function addFuzzyCalculations is called when conversion is completed with the result as the argument **/
    Papa.parse(csvData, {
        complete: addFuzzyCalculations,
        delimiter: separator === "tab" ? "\t" : separator,
        skipEmptyLines: true,
    });
}

function showErrorMessage(message) {
    console.error(message);
    const currentLocationWithoutHash = window.location.href.split("#")[0];
    window.location = currentLocationWithoutHash + "#errorMessage";  /** Move tab focus to popup **/
    errorMessageEl.classList.add('message--visible');
    errorMessageContentEl.innerHTML = message;
    document.body.classList.add('disable-scrolling');
    fileInputEl.value = ""; /** deselect the fileInputEl, so a change is also triggered when the same file uploaded again. **/
}

function showAgreeMessage(message, agreeCallback, cancelCallback) {
    const currentLocationWithoutHash = window.location.href.split("#")[0];
    window.location = currentLocationWithoutHash + "#agreeMessage"; /** Move tab focus to popup **/
    agreeMessageEl.classList.add('message--visible');
    agreeMessageContentEl.innerHTML = message;
    document.body.classList.add('disable-scrolling');

    /** Clean event listeners for the next time the agree message is shown. **/
    function removeEventListeners() {
        agreeMessageAgreeButton.removeEventListener("click", agree);
        agreeMessageCancelButton.removeEventListener("click", cancel);
    }

    function agree() {
        removeEventListeners()
        agreeCallback();
    }

    agreeMessageAgreeButton.addEventListener("click", agree);

    function cancel() {
        removeEventListeners();
        cancelCallback();
    }

    agreeMessageCancelButton.addEventListener("click", cancel);
}

function closeMessage(e) {
    e.preventDefault();
    const messageEl = e.target.closest(".message");
    messageEl.classList.remove("message--visible")
    document.body.classList.remove("disable-scrolling");
    setTimeout(() => messageEl.querySelector(".js-message-content").innerHTML = "", 100);
}

function isInputDataValid(data) {
    const indexOfRowWithDeviatingLength = data.findIndex(row => row.length !== data[0].length);
    if (indexOfRowWithDeviatingLength !== -1) {
        const rowNr = indexOfRowWithDeviatingLength + 1;
        showErrorMessage(
            'Row ' + rowNr + ' contains a different amount of columns than the amount in row 1. ' +
            'This error could indicate, for instance, that row ' + rowNr + ' contains one or several columns ' +
            'too many, or that the text data in the columns in that row already contain a ' + separator + ' ' +
            '(i.e., one that was not meant to be interpreted as a column separator). Please supply ' +
            'an input .csv file with the same number of columns in each row, and without any ' +
            'separator characters in the text data itself (other than those to be used as separators).'
        );
        return false;
    }

    const rowsHaveAtLeastTwoColumns = data.every(row => (row.length > 1) && row[1] !== ""); /** Also check if second column has content**/
    if (!rowsHaveAtLeastTwoColumns) {
        showErrorMessage(
            'The rows in the input .csv file do not contain at least two columns. If the input .csv does have at least ' +
            'two columns, this error could indicate that the file does not have ' + separator + ' as column separator. Please supply an ' +
            'input .csv file with ' + separator + ' as column separator or select a different separator.'
        );
        return false;
    }

    const hasTargetColumnHeader = data[0].some(cell => cell.toLowerCase() === "target");
    if (!hasTargetColumnHeader) {
        showErrorMessage(
            "The input .csv file does not have a column with the name 'target'. Please " +
            "supply an input .csv file with one column labelled 'target' in the first row."
        );
        return false;
    }

    const hasResponseColumnHeader = data[0].some(cell => cell.toLowerCase() === "response");
    if (!hasResponseColumnHeader) {
        showErrorMessage(
            "The input .csv file does not have a column with the name 'response'. Please " +
            "supply an input .csv file with one column labelled 'response' in the first row."
        );
        return false;
    }

    return true;
}

function addFuzzyCalculations(parsedResult) {
    /** jsonData is now an array of arrays ("rows") **/
    const jsonData = parsedResult.data;

    if (!isInputDataValid(jsonData)) {
        return;
    }

    /** Figure out what the index is of the target and response columns **/
    const indexOfTargetColumn = jsonData[0].findIndex(cell => cell.toLowerCase() === 'target');
    const indexOfResponseColumn = jsonData[0].findIndex(cell => cell.toLowerCase() === 'response');

    /** Loop over the results data with the map function. For every row: do modifications. The map function returns
     * the modified array of arrays to dataWithFuzzyCalculations. **/
    const dataWithFuzzyCalculations = jsonData.map((row, i) => {
        if (i === 0) {
            /** For the first row, add "“TSR_score”" as the last array item ("column") **/
            row.push('TSR_score');
        } else {
            /** Otherwise, do fuzzball magic with the data in the target and response cells and add
             * the result as the last array item **/
            const target = row[indexOfTargetColumn];
            const response = row[indexOfResponseColumn];
            const fuzzyCalculation = fuzzball.token_sort_ratio(target, response);

            row.push(fuzzyCalculation);
        }

        /** Return the modified array ("row") to the map method. It uses it to return the modified array of arrays to
         * dataWithFuzzyCalculations **/
        return row;
    });

    convertToCsvAndSaveFile(dataWithFuzzyCalculations);
}

function convertToCsvAndSaveFile(jsonData) {
    const csvData = Papa.unparse(
        jsonData,
        {delimiter: separator === "tab" ? "\t" : separator}
    );
    const blob = new Blob([csvData], {
        type: "text/plain;charset=utf-8;",
    });
    saveAs(blob, "output.csv");
    fileInputEl.value = ""; /** deselect the fileInputEl, so a change is also triggered when the same file uploaded again. **/
}

function handleFileInputChange(e) {
    const noFile = e.target.files.length === 0;
    if (noFile) {
        console.log('no file');
        return;
    }

    showAgreeMessage(
        "Users are asked to agree to cite Bosker (2021) in any publications that use this tool.\n\n" +
        "Bosker, H. R. (2021). Using fuzzy string matching for automated assessment of listener " +
        "transcripts in speech intelligibility studies. <i>Behavior Research Methods</i>.\n\n" +
        "By clicking 'OK', you agree to this condition.",
        function () {
            const file = e.target.files[0];

            /** See https://developer.mozilla.org/en-US/docs/Web/API/FileReader **/
            const reader = new FileReader();
            reader.onload = handleFileLoaded;

            /** After the file is loaded via readAsText (method of FileReader API), the function handleFileLoaded is called **/
            reader.readAsText(file);
        },
        function () {
            fileInputEl.value = ""; /** deselect the fileInputEl, so a change is also triggered when the same file uploaded again. **/
        }
    )
}

function handleFileInputClick(e) {
    if (!separator) {
        separatorErrorEl.classList.add("separator-select-error--visible");
        e.preventDefault();
    }
}

function selectLastUsedSeparatorFromLocalStorage() {
    const savedSeparator = localStorage.getItem('separator');

    if (savedSeparator) {
        separator = savedSeparator;
        separatorSelectEl.value = savedSeparator;
    }
}

function setSeparator() {
    /** Update the global separator variable, with the selected separator. **/
    separator = separatorSelectEl.value;

    /** Update the local storage, so this separator can be used by default on later visits/refreshes: **/
    localStorage.setItem('separator', separator);

    if (separator) {
        separatorErrorEl.classList.remove("separator-select-error--visible");
    }
}

/** Get the user's last selected separator from the local storage and select it. **/
selectLastUsedSeparatorFromLocalStorage();

/** Every change in the separator select element, we update the global separator variable and the local storage. **/
separatorSelectEl.addEventListener('change', setSeparator);

/** To validate whether a separator is selected, call handleFileInputClick **/
fileInputEl.addEventListener('click', handleFileInputClick);

/** When the file is selected, call handleFileInputChange **/
fileInputEl.addEventListener('change', handleFileInputChange);

/** Hide field error message when clicked on it **/
separatorErrorEl.addEventListener("click", () => separatorErrorEl.classList.remove('separator-select-error--visible'))

/** Hide message popup when Close message button is clicked **/
closeMessageButtons.forEach(button => button.addEventListener("click", closeMessage));