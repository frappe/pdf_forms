import type { FrappeDoc } from "frappe-react-sdk"
import moment from "moment"

/**
 * Utility to convert SQL datetime2(6) timestamp to Javascript Date object
 * @param timeStamp takes SQL datetime2(6) - 8 byte timestamp
 * @returns Javascript Date object
 */
export const SQLDatetime2_6toJSDateObject = (timeStamp: string): Date => {
    // Split
    const t = timeStamp.split(/[- :]/)
    // convert
    const dateObject = new Date(
        Date.UTC(parseInt(t[0]), parseInt(t[1]) - 1, parseInt(t[2]), parseInt(t[3]), parseInt(t[4]), parseFloat(t[5]))
    )
    // return date in Date Object format with 5 hours 30 minutes removed for IST
    return moment(dateObject).subtract(330, "minutes").toDate()
}

/**
 * Utility to convert Date object to DD-MM-YYYY format
 * @param date takes Javascript Date object
 * @returns Date string in DD-MM-YYYY format
 */
export const DateObjectToDateString = (date: Date): string => {
    return (date.getDate() < 10 ? date.getDate().toString().padStart(2, "0") : date.getDate()) + "-" + (date.getMonth() < 9 ? (date.getMonth() + 1).toString().padStart(2, "0") : date.getMonth() + 1) + "-" + date.getFullYear()
}

/**
 * makeid - generates a random string of length l
 * @param l - length of the string
 * @returns a random string of length l
 */
export const makeid = (l: number): string => {
    let text = "";
    const char_list = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < l; i++) {
        text += char_list.charAt(Math.floor(Math.random() * char_list.length));
    }
    return text + Date.now();
}

export const flt = (value?: number | string | null, decimals?: number, rounding_method?: string) => {
    if (value === undefined || value === null || value === "") return 0

    if (typeof value !== "number") {
        value = Number(typeof value === 'string' ? value?.split(",")?.join("") : value)

        if (isNaN(value)) return 0
    }

    //TODO: We need to round the value here
    if (decimals !== undefined && decimals !== null) {
        return _round(value, decimals, rounding_method)
    }

    return value
}

const _round = (num: number, precision: number, rounding_method?: string) => {

    rounding_method = rounding_method || "Banker's Rounding (legacy)";

    const is_negative = num < 0;

    if (rounding_method == "Banker's Rounding (legacy)") {
        const d = cint(precision);
        const m = Math.pow(10, d);
        const n = +(d ? Math.abs(num) * m : Math.abs(num)).toFixed(8); // Avoid rounding errors
        const i = Math.floor(n);
        const f = n - i;
        let r = !precision && f == 0.5 ? (i % 2 == 0 ? i : i + 1) : Math.round(n);
        r = d ? r / m : r;
        return is_negative ? -r : r;
    } else if (rounding_method == "Banker's Rounding") {
        if (num == 0) return 0.0;
        precision = cint(precision);

        const multiplier = Math.pow(10, precision);
        num = Math.abs(num) * multiplier;

        const floor_num = Math.floor(num);
        const decimal_part = num - floor_num;

        // For explanation of this method read python flt implementation notes.
        const epsilon = 2.0 ** (Math.log2(Math.abs(num)) - 52.0);

        if (Math.abs(decimal_part - 0.5) < epsilon) {
            num = floor_num % 2 == 0 ? floor_num : floor_num + 1;
        } else {
            num = Math.round(num);
        }
        num = num / multiplier;
        return is_negative ? -num : num;
    } else if (rounding_method == "Commercial Rounding") {
        if (num == 0) return 0.0;

        const digits = cint(precision);
        const multiplier = Math.pow(10, digits);

        num = num * multiplier;

        // For explanation of this method read python flt implementation notes.
        let epsilon = 2.0 ** (Math.log2(Math.abs(num)) - 52.0);
        if (is_negative) {
            epsilon = -1 * epsilon;
        }

        num = Math.round(num + epsilon);
        return num / multiplier;
    } else {
        throw new Error(`Unknown rounding method ${rounding_method}`);
    }
}

export const cint = (v: unknown, def?: number): number => {
    if (v === true) return 1;
    if (v === false) return 0;
    let vStr = String(v);
    if (vStr !== "0") vStr = lstrip(vStr, ["0"]);
    const vNum = parseInt(vStr, 10);
    if (isNaN(vNum)) return def === undefined ? 0 : def;
    return vNum;
};

export const lstrip = (s: string, chars?: string[]) => {
    if (!chars) chars = ["\n", "\t", " "];
    // strip left
    let first_char = s.substring(0, 1);
    while (first_char !== undefined && chars.includes(first_char)) {
        s = s.substring(1);
        first_char = s.substring(0, 1);
    }
    return s;
};

/**
 * Function to check if a string exists in a list
 * @param list 
 * @param item 
 * @returns 
 */
export const formatCurrency = (value?: number, currency: string = 'USD', returnPlaceholder = false) => {
    const CurrencyFormat = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    if (value !== undefined && value !== null) {
        return CurrencyFormat.format(value);
    } else {
        return returnPlaceholder ? CurrencyFormat.format(0) : ''
    }
}

export const formatNumber = (value?: number, locale: string = 'en-US', options?: Intl.NumberFormatOptions, defaultReturnValue: string = '') => {
    if (value !== undefined && value !== null) {
        return new Intl.NumberFormat(locale, options).format(value);
    } else {
        return defaultReturnValue
    }
}

export const formatPercentage = (value?: number, returnPlaceholder = false, precision?: number) => {

    const PercentFormat = new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: precision || 3
    });
    if (value !== undefined && value !== null) {
        return PercentFormat.format(value / 100);
    } else {
        return returnPlaceholder ? PercentFormat.format(0) : ''
    }
}

export const formatMileage = (value?: number, locale: string = 'en-US', options?: Intl.NumberFormatOptions, returnPlaceholder = false) => {
    if (value !== undefined && value !== null) {
        return formatNumber(value, locale, { style: "unit", unit: "mile", ...options });
    } else {
        return returnPlaceholder ? formatNumber(0, locale, { style: "unit", unit: "mile", ...options }) : ''
    }
}

type BaseFields = 'owner' | 'creation' | 'modified' | 'modified_by' | 'docstatus';

export const removeFrappeFields = <T>(data: FrappeDoc<T>): Omit<FrappeDoc<T>, BaseFields> => {
    try {
        const { owner: _owner, creation: _creation, modified: _modified, modified_by: _modified_by, docstatus: _docstatus, ...withoutBaseFields } = data;
        // Suppress unused variable warnings - these are intentionally destructured to omit them
        void _owner;
        void _creation;
        void _modified;
        void _modified_by;
        void _docstatus;
        return withoutBaseFields;
    }
    catch {
        return data
    }
}