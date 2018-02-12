import _ = require('lodash');
import ActionReducers = require('./actions-reducers');
import MapFile = require('../kaze/map-file');

export type URL = string;
export type FileName = string;

const sanityCheck = (parsedJson: any): void => {
    const mapContent = parsedJson.mapContent;

    if (mapContent.name === undefined || !_.isString(mapContent.name)) throw new Error('Map has no name');
    if (mapContent.blockWidth === undefined || !_.isNumber(mapContent.blockWidth) || mapContent.blockWidth <= 0) throw new Error('Invalid map width');
    if (mapContent.blockHeight === undefined || !_.isNumber(mapContent.blockHeight) || mapContent.blockHeight <= 0) throw new Error('Invalid map height');
    if (!_.isArray(parsedJson.spriteFileNames) || !_.isString(parsedJson.spriteFileNames[0])) throw new Error('Invalid sprite files');
    if (!_.isNumber(mapContent.rows[0][0])) throw new Error('Invalid sprite reference');
    if (!_.isNumber(mapContent.barrierRows[0][0])) throw new Error('Invalid barrier data');
    if (mapContent.rows.length !== mapContent.blockHeight) throw new Error('Broken map height');
    if (mapContent.rows[0].length !== mapContent.blockWidth) throw new Error('Broken map width');
    if (!_.isObject(mapContent.markers)) throw new Error('Markers is not a map object');
    if (mapContent.markers[0] && !_.isString(mapContent.markers[0])) throw new Error('Marker is not a string');
};

export const mapStringify = (mapContent: MapFile.MapContent, fileNameToUrl: Map<URL, FileName>): string => {
    //** ES6 map retains insertion order
    // Hence, the array put into `MapFile` has same order as `fileNameToUrl` map entries,
    // which means the numbers inside `MapFile.MapContent.rows` are still correct, no sort needed
    const mapFile = new MapFile.MapFile(mapContent, Array.from(fileNameToUrl.keys()))
    return JSON.stringify(mapFile);
};

export const makeFileName = (mapName: string): string => {
    return mapName.toLowerCase().replace(/(\ )|[^a-z0-9]/g, '-') + '.json';
};

// File name -> <img> sourceable URL for all image files in `files`
const makeImageFileUrl = (files: FileList): Map<FileName, URL> => {
    const imageFileToUrl = new Map<FileName, URL>();
    for (let i = 0; i < files.length; ++i) {
        if (_.endsWith(files[i].name, '.jpg') ||
            _.endsWith(files[i].name, '.jpeg') ||
            _.endsWith(files[i].name, '.png')) { 
            imageFileToUrl.set(files[i].name, URL.createObjectURL(files[i]));
        }
    }
    return imageFileToUrl;
};

// Unlike `MapFile`, this has URLs set up instead of just file names
export interface IReadMapFile {
    mapContent: MapFile.MapContent;
    fileNameToUrl: Map<FileName, URL>;
}

// Reads one JSON file in `files`,
// making sure all referenced images in the JSON are image files  in `files`
export const readMapFile = (
    files: FileList,
    errorCallback: (e: string) => void,
    callback: (result: IReadMapFile) => void
): void => {
    const imageFileToUrl = makeImageFileUrl(files);

    // Expect only one JSON file inside `files`
    let jsonFileIndex = -1;
    for (let i = 0; i < files.length; ++i) {
        if (jsonFileIndex !== -1) {
            errorCallback('Multiple JSON files found, which is the map?');
            return;
        } else if (_.endsWith(files[i].name, '.json')) {
            jsonFileIndex = i;
        }
    }
    if (jsonFileIndex === -1) {
        errorCallback('No JSON map file found');
        return;
    }

    const reader = new FileReader;
    reader.readAsText(files[jsonFileIndex]);
    reader.onload = (e: Event): void => {
        try {
            const parsed = JSON.parse(reader.result);
            sanityCheck(parsed);  

            //** ES6 map retains insertion order
            // So `fileNameToUrl` has same order as `parsed.spriteFileNames`,
            // which means the map file ID references are still correct, no sort needed
            const fileNameToUrl = new Map<FileName, URL>();
            for (const fileName_ of parsed.spriteFileNames) {
                const fileName = fileName_ as FileName;
                const url = imageFileToUrl.get(fileName);

                if (url === undefined) {
                    throw new Error(`Referenced image ${fileName} not found`);
                } else {
                    fileNameToUrl.set(fileName, url);
                }
            }

            callback({mapContent: parsed.mapContent as MapFile.MapContent, fileNameToUrl});
        } catch (e) {
            errorCallback(e.message);
        }
    };
};

export const clone2dArray = <T>(array: T[][]): T[][] => {
    return array.map((row) => row.slice());
};

// Trick for downloading a file to disk
export const download = (json: string, fileName: FileName): void => {
    const blob = new Blob([json]);
    const url = URL.createObjectURL(blob);

    const $link = $('<a />');
    const linkElement = $link[0] as HTMLAnchorElement;
    linkElement.href = url;
    linkElement.download = fileName;

    $(document.body).append($link);
    linkElement.click();

    setTimeout(() => {
        $link.remove();
        URL.revokeObjectURL(url);  
    }); 
};
