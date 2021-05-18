import NavigationBar from "./NavigationBar";
import WeekDays from "./WeekDays";
import MessageBar from "./MessageBar";
import CalendarCell from "./CalendarCell";
import {calculateWeeksInMilliseconds, getBeginDateOfWeekByDate, getDateAsStringInWpFormat} from "./Functions";

const {__} = wp.i18n;
const $ = jQuery;

export default function AsyncCalendar(props) {
    const theme = (props.theme || 'light');

    const [firstDateToDisplay, setFirstDateToDisplay] = React.useState(props.firstDateToDisplay);
    const [cells, setCells] = React.useState({});
    const [isLoading, setIsLoading] = React.useState(false);
    const [message, setMessage] = React.useState();

    let $lastHoveredCell;

    const getUrl = (action, query) => {
        if (!query) {
            query = '';
        }

        return props.ajaxUrl + '?action=' + action + '&nonce=' + props.nonce + query;
    };

    const prepareCells = (newDate) => {
        const numberOfDaysToDisplay = props.numberOfWeeksToDisplay * 7;
        const firstDate = (newDate) ? newDate : firstDateToDisplay;

        let newCells = {};
        let cell;
        let dayDate;
        let dateString;
        let lastMonthDisplayed = firstDate.getMonth();
        let shouldDisplayMonthName;

        setIsLoading(true);
        setMessage(__('Loading...', 'publishpress'));

        fetchData().then((data) => {
            for (let i = 0; i < numberOfDaysToDisplay; i++) {
                dayDate = new Date(firstDate);
                dayDate.setDate(dayDate.getDate() + i);
                dateString = getDateAsStringInWpFormat(dayDate);

                shouldDisplayMonthName = lastMonthDisplayed !== dayDate.getMonth() || i === 0;

                cell = {
                    date: dayDate,
                    shouldDisplayMonthName: shouldDisplayMonthName,
                    isLoading: false,
                    items: []
                };

                if (data[dateString]) {
                    cell.items = data[dateString];
                }

                newCells[getDateAsStringInWpFormat(dayDate)] = cell;

                lastMonthDisplayed = dayDate.getMonth();
            }

            setCells(newCells);

            setIsLoading(false);
            setMessage(null);
        });
    };

    const fetchData = async () => {
        const dataUrl = getUrl(props.actionGetData, '&start_date=' + getDateAsStringInWpFormat(props.firstDateToDisplay) + '&number_of_weeks=' + props.numberOfWeeksToDisplay);

        const response = await fetch(dataUrl);
        return await response.json();
    }

    const navigateByOffsetInWeeks = (offsetInWeeks) => {
        const offsetInMilliseconds = calculateWeeksInMilliseconds(offsetInWeeks);

        const newDate = new Date(
            firstDateToDisplay.getTime() + offsetInMilliseconds
        );

        setFirstDateToDisplay(newDate);

        prepareCells(newDate);
    };

    const handleRefreshOnClick = (e) => {
        e.preventDefault();

        prepareCells();
    };

    const handleBackPageOnClick = (e) => {
        e.preventDefault();

        navigateByOffsetInWeeks(props.numberOfWeeksToDisplay * -1);
    };

    const handleBackOnClick = (e) => {
        e.preventDefault();

        navigateByOffsetInWeeks(-1);
    };

    const handleForwardOnClick = (e) => {
        e.preventDefault();

        navigateByOffsetInWeeks(1);
    }

    const handleForwardPageOnClick = (e) => {
        e.preventDefault();

        navigateByOffsetInWeeks(props.numberOfWeeksToDisplay);
    };

    const handleTodayOnClick = (e) => {
        e.preventDefault();

        const newDate = getBeginDateOfWeekByDate(props.todayDate, props.weekStartsOnSunday);
        setFirstDateToDisplay(newDate);

        prepareCells(newDate);
    };

    const getItemByDateAndIndex = (date, index) => {
        return cells[date].items[index];
    };

    const moveItemToNewDate = async (itemDate, itemIndex, newYear, newMonth, newDay) => {
        let item = getItemByDateAndIndex(itemDate, itemIndex);

        setIsLoading(true);
        setMessage(__('Moving the item...', 'publishpress'));

        const dataUrl = getUrl(props.actionMoveItem);

        const formData = new FormData();
        formData.append('id', item.id);
        formData.append('year', newYear);
        formData.append('month', newMonth);
        formData.append('day', newDay);

        const response = await fetch(dataUrl, {
            method: 'POST',
            body: formData
        });

        response.json().then(() => {
            prepareCells();
        });
    }

    const handleOnDropItemCallback = (event, ui) => {
        const $dayCell = $(event.target).parent();
        const $item = $(ui.draggable[0]);
        const dateTime = getDateAsStringInWpFormat(new Date($item.data('datetime')));
        const $dayParent = $(event.target).parents('li');

        $dayParent.addClass('publishpress-calendar-day-loading');

        moveItemToNewDate(
            dateTime,
            $item.data('index'),
            $dayCell.data('year'),
            $dayCell.data('month'),
            $dayCell.data('day')
        ).then(() => {
            $dayParent.removeClass('publishpress-calendar-day-hover');
            $dayParent.removeClass('publishpress-calendar-day-loading');
        });
    };

    const handleOnHoverCellCallback = (event, ui) => {
        if ($lastHoveredCell) {
            $lastHoveredCell.removeClass('publishpress-calendar-day-hover');
        }

        const $dayParent = $(event.target).parents('li');
        $dayParent.addClass('publishpress-calendar-day-hover');

        $lastHoveredCell = $dayParent;
    };

    const initDraggable = () => {
        $('.publishpress-calendar-day-items li').draggable({
            zIndex: 99999,
            helper: 'clone',
            opacity: 0.40,
            containment: '.publishpress-calendar-days',
            cursor: 'move',
            classes: {
                'ui-draggable': 'publishpress-calendar-draggable',
                'ui-draggable-handle': 'publishpress-calendar-draggable-handle',
                'ui-draggable-dragging': 'publishpress-calendar-draggable-dragging',
            }
        });

        $('.publishpress-calendar-day-items').droppable({
            addClasses: false,
            classes: {
                'ui-droppable-hover': 'publishpress-calendar-state-active',
            },
            drop: handleOnDropItemCallback,
            over: handleOnHoverCellCallback
        });
    };

    const calendarBodyCells = () => {
        let bodyCells = [];
        let cell;

        for (const date in cells) {
            cell = cells[date];

            bodyCells.push(
                <CalendarCell
                    key={'day-' + cell.date.getTime()}
                    date={cell.date}
                    shouldDisplayMonthName={cell.shouldDisplayMonthName}
                    todayDate={props.todayDate}
                    isLoading={cell.isLoading}
                    items={cell.items}
                    timeFormat={props.timeFormat}/>
            );
        }

        return bodyCells;
    };

    React.useEffect(prepareCells, []);
    React.useEffect(initDraggable);

    return (
        <div className={'publishpress-calendar publishpress-calendar-theme-' + theme}>
            <NavigationBar
                refreshOnClickCallback={handleRefreshOnClick}
                backPageOnClickCallback={handleBackPageOnClick}
                backOnClickCallback={handleBackOnClick}
                forwardOnClickCallback={handleForwardOnClick}
                forwardPageOnClickCallback={handleForwardPageOnClick}
                todayOnClickCallback={handleTodayOnClick}/>

            <MessageBar showSpinner={isLoading} message={message}/>

            <div className="publishpress-calendar-section">
                <WeekDays weekStartsOnSunday={props.weekStartsOnSunday}/>
                <ul className="publishpress-calendar-days">{calendarBodyCells()}</ul>
            </div>
        </div>
    )
}
