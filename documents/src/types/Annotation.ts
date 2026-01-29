export interface Annotation {
    "id": string;
    "@context": "http://www.w3.org/ns/anno.jsonld",
    "type": "Annotation",
    "body": AnnotationBodyElement[],
    "target": {
        "source": string,
        "selector": {
            "type": "FragmentSelector",
            "conformsTo": "http://www.w3.org/TR/media-frags/",
            "value": string
        }
    },
}

export interface AnnotationBodyElement {
    "type": "TextualBody",
    "purpose": "tagging" | "comment",
    "value": string
}