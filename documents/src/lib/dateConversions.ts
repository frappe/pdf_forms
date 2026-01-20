import moment from "moment-timezone"
import type { Moment } from "moment-timezone"


export const FRAPPE_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
export const FRAPPE_DATE_FORMAT = 'YYYY-MM-DD'
export const FRAPPE_TIME_FORMAT = 'HH:mm:ss'
const DEFAULT_TIME_ZONE = 'America/Chicago'
// @ts-expect-error - window.frappe may not be defined in all contexts
export const SYSTEM_TIMEZONE = window.frappe?.boot?.time_zone?.system || DEFAULT_TIME_ZONE

/**
 * Utility to convert SQL datetime2(6) timestamp to Javascript Date object
 * @param timeStamp takes SQL datetime2(6) - 8 byte timestamp
 * @returns Javascript Date object
 * @deprecated
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
 * @deprecated
 */
export const DateObjectToDateString = (date: Date): string => {
    return (date.getDate() < 10 ? date.getDate().toString().padStart(2, "0") : date.getDate()) + "-" + (date.getMonth() < 9 ? (date.getMonth() + 1).toString().padStart(2, "0") : date.getMonth() + 1) + "-" + date.getFullYear()
}

/**
 * Utility to convert Date object to MM-DD-YYYY format
 * @param date takes Javascript Date object
 * @returns Date string in MM-DD-YYYY format
 * @deprecated
 */
export const DateObjectToUSDateString = (date: Date): string => {
    return (date.getMonth() < 9 ? (date.getMonth() + 1).toString().padStart(2, "0") : date.getMonth() + 1) + "-" + (date.getDate() < 10 ? date.getDate().toString().padStart(2, "0") : date.getDate()) + "-" + date.getFullYear()
}

/**
 * Utility to convert Date string in YYYY-MM-DD format to MM-DD-YYYY format
 * @param date takes Date string in YYYY-MM-DD format
 * @returns Date string in MM-DD-YYYY format
 * @deprecated
 */
export const DateStringToUSDateString = (date?: string): string => {
    if (date) {
        const dates = date.split('-')
        return dates[1] + "-" + dates[2] + "-" + dates[0]
    }
    return ''
}

/**
 * Utility to convert Date object to YYYY-MM-DD format
 * @param date takes Javascript Date object
 * @returns Date string in YYYY-MM-DD format
 */
export const convertMomentToStringDate = (moment: Moment) => {

    if (moment) {
        return moment.format('YYYY/MM/DD').replace(/\//g, '-')
    }
    return ''
}

/**
 * Utility to convert String date to Moment
 * @param date takes String date
 * @returns Moment
 */
export const convertStringDateToMoment = (date: string, format: string = 'YYYY/MM/DD') => {
    if (date) {
        return moment(date, format)
    }
    return null
}

/**
 * Utility to convert Date object to YYYY-MM-DD format
 * @param date takes Javascript Date object
 * @returns Date string in YYYY-MM-DD format
 */
export const convertMomentToStringDateTime = (moment: Moment) => {

    if (moment) {
        return moment.format('YYYY/MM/DD HH:mm:ss').replace(/\//g, '-')
    }
    return ''
}

/**
 * Utility to convert String date to Moment
 * @param date takes String date
 * @returns Moment
 */
export const convertStringDateTimeToMoment = (date: string) => {
    if (date) {
        return moment(date, 'YYYY/MM/DD HH:mm:ss')
    }
    return null
}

/**
 * Utility time string to 12 hour format
 * @param time takes time string
 * @returns time string in 12 hour format
 */
export const timeTo12HrFormat = (time: string) => {
    if (time) {
        const [hours, minutes] = time.split(':')
        const paddedHours = String(hours).padStart(2, '0');
        const paddedMinutes = String(minutes).padStart(2, '0');

        return `${paddedHours}:${paddedMinutes}`
    }
    return ''
}

/**
 * Function to sort an array of object by date
 * @param arr Array to sort
 * @param field date field name
 * @returns 
 */
export const sortByDate = <T extends Record<string, unknown>>(arr: T[], field: string): T[] => {
    return arr.sort((a, b) => {
        const aValue = a[field]
        const bValue = b[field]
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return moment(bValue).valueOf() - moment(aValue).valueOf()
        }
        return 0
    })
}

/**
 * Function to convert a date string (YYYY-MM-DD) to a date object
 */
export const convertStringToDate = (date?: string) => {
    if (date) {
        const dates = date.split('-')
        return new Date(parseInt(dates[0]), parseInt(dates[1]) - 1, parseInt(dates[2]))
    }
    return null
}

/**
 * Function to convert a date object to a date string (YYYY-MM-DD)
 */
export const convertDateToString = (date?: Date | null) => {
    if (date) {
        return moment(date).format('YYYY-MM-DD')
    }
    return ''
}
/**
 * Function to convert a date object to a time string (HH:mm:ss)
 */
export const convertDateToTimeString = (date?: Date | null) => {
    if (date) {
        return moment(date).format('HH:mm:ss')
    }
    return ''
}

/**
 * 
 * @param date A frappe datetime string in the format YYYY-MM-DD HH:mm:ss
 */
export const convertDateTimeStringtoReadableDateString = (date?: string) => {
    if (date) {
        return moment(date).format('DD/MM/YYYY')
    }
    return ''
}

/**
 * Function to convert a date time string to a date time object
 */
export const convertStringToDateTime = (date?: string) => {
    if (date) {
        return moment(date, 'YYYY/MM/DD HH:mm:ss').toDate()
    }
    return null
}

/**
 * Function to convert a date time object to a date time string
 */
export const convertDateTimeToString = (date?: Date | null) => {
    if (date) {
        return moment(date).format('YYYY-MM-DD HH:mm:ss')
    }
    return ''
}


/**
 * Function to convert a time string to a time object
 * @param time A time string in the format HH:mm:ss
 * @returns 
 */
export const convertTimeStringToDate = (time?: string) => {
    if (time) {
        return moment(time, 'HH:mm:ss').toDate()
    }
    return null
}

// NEW Functions to be used
// Functions to convert Frappe Timestamp (in string) to readable formats

/**
 * Converts Frappe datetime timestamp to readable string
 * @param timestamp A frappe timestamp string in the format YYYY-MM-DD HH:mm:ss
 * @param format Format can include both date and time formats
 * @returns 
 */
export const convertFrappeTimestampToReadableDate = (timestamp?: string, format: string = 'MM-DD-YYYY') => {
    if (timestamp) {
        return moment(timestamp, 'YYYY-MM-DD HH:mm:ss').format(format)
    }
    return ''
}

/**
 * Converts Frappe datetime timestamp to readable string
 * @param timestamp A frappe timestamp string in the format YYYY-MM-DD HH:mm:ss
 * @param format Format can include both date and time formats
 * @returns 
 */
export const convertFrappeTimestampToReadableDateTime = (timestamp?: string, format: string = 'MM-DD-YYYY HH:mm A') => {
    if (timestamp) {
        return convertFrappeTimestampToReadableDate(timestamp, format)
    }
    return ''
}

export const convertFrappeTimestampToReadableTime = (timestamp?: string, format: string = 'hh:mm A') => {
    if (timestamp) {
        return moment(timestamp, 'YYYY-MM-DD HH:mm:ss').format(format)
    }
    return ''

}
/**
 * Converts Frappe date timestamp to readable string
 * @param date A frappe date string in the format YYYY-MM-DD
 * @param format Format can only include date formats
 * @returns 
 */
export const convertFrappeDateStringToReadableDate = (date?: string, format: string = 'MM-DD-YYYY') => {
    if (date) {
        return moment(date, 'YYYY-MM-DD').format(format)
    }
    return ''
}

/**
 * Converts Frappe time timestamp to readable string
 * @param time A frappe time string in the format HH:mm:ss
 * @param format Format can only include time formats
 * @returns 
 */
export const convertFrappeTimeStringToReadableTime = (time?: string, format: string = 'hh:mm:ss A') => {
    if (time) {
        return moment(time, 'HH:mm:ss').format(format)
    }
    return ''
}

/**
 * Converts a Frappe timestamp to a readable time ago string
 * @param timestamp A frappe timestamp string in the format YYYY-MM-DD HH:mm:ss
 * @param withoutSuffix remove the suffix from the time ago string
 * @returns 
 */
export const convertFrappeTimestampToTimeAgo = (timestamp?: string, withoutSuffix?: boolean) => {

    if (timestamp) {
        const date = convertFrappeTimestampToUserTimezone(timestamp)

        return date.fromNow(withoutSuffix)
    }
    return ''
}

export const convertFrappeTimestampToUserTimezone = (timestamp: string): Moment => {
    // @ts-expect-error - window.frappe may not be defined in all contexts
    const systemTimezone = window.frappe?.boot?.time_zone?.system
    // @ts-expect-error - window.frappe may not be defined in all contexts
    const userTimezone = window.frappe?.boot?.time_zone?.user

    if (systemTimezone && userTimezone) {
        return moment.tz(timestamp, systemTimezone).clone().tz(userTimezone)
    } else {
        return moment(timestamp)
    }
}

/**
 * Converts a Frappe date to a readable time ago string
 * @param date A frappe date string in the format YYYY-MM-DD
 * @param withoutSuffix remove the suffix from the time ago string
 * @returns 
 */
export const convertFrappeDateStringToTimeAgo = (date?: string, withoutSuffix?: boolean) => {
    if (date) {
        const userDate = convertFrappeTimestampToUserTimezone(date)
        return userDate.fromNow(withoutSuffix)
    }
    return ''
}

export const getAgeFromFrappeTimestamp = (date?: string, diff: moment.unitOfTime.Diff = 'days') => {
    if (date) {
        const userDate = convertFrappeTimestampToUserTimezone(date)
        return moment().diff(userDate, diff)
    }
    return ''
}


/**
 * Function returns today's date in various formats 
 * @param return_form 
 * @returns 
 */
function getToday(return_form: "obj"): Date;
function getToday(return_form?: "datetime"): string;
function getToday(return_form?: "date"): string;
function getToday(return_form?: "time"): string;
function getToday(return_form = 'datetime') {
    if (return_form === 'obj') {
        return moment().tz(SYSTEM_TIMEZONE).toDate()
    } else if (return_form === 'date') {
        return moment().tz(SYSTEM_TIMEZONE).format(FRAPPE_DATE_FORMAT)
    } else if (return_form === 'time') {
        return moment().tz(SYSTEM_TIMEZONE).format(FRAPPE_TIME_FORMAT)
    } else {
        return moment().tz(SYSTEM_TIMEZONE).format(FRAPPE_DATETIME_FORMAT)
    }
}

export const today = getToday


/**
 * Function returns difference between two dates in years, months and days
 * @param date1
 * @param date2 
 * @returns { years: number, months: number, days: number}
 */
export const getDifference = (date1: string, date2: string) => {
    const d1 = moment(date1, FRAPPE_DATE_FORMAT)
    const d2 = moment(date2, FRAPPE_DATE_FORMAT)

    const years = d2.diff(d1, 'year')
    d1.add(years, 'years')

    const months = d2.diff(d1, 'months')
    d1.add(months, 'months')

    const days = d2.diff(d1, 'days')

    return { years, months, days }
}