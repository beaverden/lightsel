'use strict';
//TODO
// Remove click after drag
// Add object
// Remove object
// Infinite scroll
// Autoscroll delay

//Firing events:
//objectClicked -> detail,carouselId, detail.objectId
//carouselDragStart -> detail.carouselId
//carouselDragEnd -> detail.carouselId
//carouselDragged -> detail.carouselId, detail.dragAmount
//carouselMoved -> detail.carouselId, detail.moveAmount, detail.direction

/* Notes
    element.children in IE8 returns comment nodes
*/
var Carousel = window.Carousel || {};


Carousel = (function() {
    function Carousel(import_settings) {
        this.settings = {
        //If the use can spin infinitely to the right or left
        infiniteSpin: true,
        //Local settings for infinite spin
        realFirst: null,
        realFirstID: 0,
        copyFirst: null,
        realLast: null,
        realLastID: 0,
        copyLast: null,
        //If the carousel scroll automatically
        autoscroll: false,
        autoscroll_interval: 3000,

        //If there are not enough objects to fill the container, it will create copies of it
        fillWithCopies: true,
        filledWithCopies: false,

        //If the user is allowed to spin the carousel if the objects fill entirely
        //in the container and don't overflow
        spinOnLessObjects: true,

        //direction
        direction: "horizontal",

        id: "carousel1",

        //The amount of time that is passed to the
        //SetInterval function that changes object every iteration
        //When the arrow button is holded (mouse pressed)
        arrowHoldChangeObjectInterval: 100,



        //Turn on or off events
        //If the browser doesn't support events, an console error log will be written
        events: true,

        //Global objects
        carousel: null,
        movingWrapper: null,
        moving: null,
        objects: null,
        toFirst: null,
        toLast: null,

        //The decaying of the inertion after a drag
        inertionStartSpeed: 20,

        //local
        totalObjects: 0,
        previousActiveObject: -1,
        currentActiveObject: 0,
        currentRelativePosition: 0,

        //The position of the first element in the initial start (after fill if needed)
        //It will be used to detect the needed position and reset the carousel to emulate infinite spin
        firstInitialPosition: 0,

        //The position of the last element in the initial start (after fill if needed)
        //It will be used to detect the needed position and reset the carousel to emulate infinite spin
        lastInitialPosition: 0,
        hasTransform: true,
    };

        //Override the current this.settings
        for (var key in import_settings) {
            this.settings[key] = import_settings[key];
        }


        var _ = this;

        _.init();

        //PUBLIC API
            /*
        this.next = function(callback) {
            setActiveAndShow(_.settings.mainElement, getNextObjectId());

            if (typeof callback !== 'undefined') {
               callback();
            }
        }

        this.previous = function(callback) {
            setActiveAndShow(_.settings.mainElement, getPreviousObjectId());

            if (typeof callback !== 'undefined') {
               callback();
            }
        }

        this.setActiveObject = function(newActive, callback) {
            setActive(_.settings.mainElement, newActive);

            if (typeof callback !== 'undefined') {
               callback();
            }
        }

        this.getCurrentActiveObject = function() {
            return _.settings.currentActiveObject;
        }

        this.showObject = function(objId, callback) {
            showObject(_.settings.mainElement, objId);

            if (typeof callback !== 'undefined') {
               callback();
            }
        }


        this.addObject = function(object, place, callback) {

            var main = _.settings.mainElement;
            var moving = main.querySelector(".moving");


            if (typeof callback !== 'undefined') {
               callback();
            }
        }
        */
    }

    return Carousel;

}());


Carousel.prototype.init = function() {
    var _ = this;

     //Main container
    _.settings.carousel = document.getElementById(_.settings.id);

    _.settings.movingWrapper = _.settings.carousel.querySelector(".moving-wrapper");
    _.settings.moving = _.settings.carousel.querySelector(".moving");
    _.settings.objects = _.settings.carousel.querySelectorAll(".object");

    //Total number of objects
    _.settings.totalObjects = _.settings.movingWrapper.children.length;

    //Arrows
    _.settings.toFirst = _.settings.carousel.querySelector(".carousel-left");
    _.settings.toLast = _.settings.carousel.querySelector(".carousel-right");

    var elem = _.settings.carousel;

    if (elem === 'undefined') {
        console.log("Wrong carousel id");
    }




    if (_.settings.direction === "vertical") {
        elem.className += "lightrousel_vertical";
    }

    if (_.settings.fillWithCopies) {
        _.fillWithCopies();
    }

    _.settings.hasTransform = _.detectCSSFeature("transform");

    _.settings.firstInitialPosition = _.settings.objects[0].getBoundingClientRect().left;
    _.settings.lastInitialPosition = _.settings.objects[_.settings.objects.length-1].getBoundingClientRect().right;

    if (_.settings.infiniteSpin) {
        if (!_.settings.filledWithCopies) {
            _.fillWithCopies();
        }
        _.infiniteSpin();
    }

    //Add click events to objects
    _.clickEvents();

    _.dragEvents();

    _.clickEventsArrows();

    _.holdArrowsEvents();

    _.keyBoardArrowsEvent();


}

//Add listener


/* EVENTS */
//Generate custom events
//As well as dispatches them
Carousel.prototype.genEventAndDispatch = function(name, detail) {
    var _ = this;

    if (_.settings.events) {
        if (typeof CustomEvent === "function") {
            var e = new CustomEvent(name, {
                detail : detail,
                bubbles: true,
                cancelable: true,
            });
            _.settings.carousel.dispatchEvent(e);
        } else {
            console.log("Lightrousel: events not supported");
        }
    }
}

//Adds click events to the objects of the carousel
//Clicking them will also generate an event [objectClicked]
Carousel.prototype.clickEvents = function() {
    var _ = this;
    var clickAction = function(event) {
        _.genEventAndDispatch("objectClicked", {
                carouselId: _.settings.id,
                objectId: this.getAttribute("data-id"),
        });
        _.setActive(this.getAttribute("data-id"));
    }

    for (var i = 0; i<_.settings.objects.length; i++) {
        var obj = _.settings.objects[i];
        obj.setAttribute("data-id", i);

        if (obj.addEventListener) {
            obj.addEventListener("click", clickAction);
        } else {
            obj.attachEvent("onclick", clickAction);
        }

    }
}

//Adds drag functionality to the carousel
//Drag start will fire and even [carouselDragStart]
//Dragging will fire the event [carouselDragged]
//End of dragging will fire [carouselDragEnd]
Carousel.prototype.dragEvents = function() {
    var _ = this;
    var elem = _.settings.carousel;
    var moving = _.settings.moving;
    var movingWrapper = _.settings.movingWrapper;
    var lastDiff = 0;

    /**** DRAG ****/
    moving.onclick = function(event) {
        return false;
    }

    moving.onmousedown = function(event) {

        _.genEventAndDispatch("carouselDragStart", {
                carouselId: elem.id
        });

        var currPos = 0;
        var dir = _.getDirection();

        if (dir == 1) {
            currPos = event.clientX;
        } else if (dir == 2) {
            currPos = event.clientY;
        }

        document.onmousemove = function(event) {
            event.preventDefault ? event.preventDefault() : (event.returnValue = false);

            var eventPos = 0;
            if (dir == 1) {
                eventPos = event.clientX;
            } else if (dir == 2) {
                eventPos = event.clientY;
            }

            var diff = eventPos - currPos;
            currPos = eventPos;
            lastDiff = diff;

            _.genEventAndDispatch("carouselDragged", {
                carouselId: _.settings.carousel.id,
                dragAmout: diff,
            });


            _.translateMoving(diff);
        }

        document.onmouseup = function(event) {

            document.onmousemove = null;
            document.onmouseup = null;

            //Fire dragEnd event
            _.genEventAndDispatch("carouselDragEnd", {
                carouselId: _.settings.carousel.id
            });

            if (Math.abs(lastDiff) > 3) {
                _.spinInertion(lastDiff);
            }
            lastDiff = 0;

            event.preventDefault ? event.preventDefault() : (event.returnValue = false);
            event.stopPropagation ? event.stopPropagation() : (event.cancelBubble = true);
        }

    }
    /**** /.DRAG ****/
};


//Left and right keyboard arrows will do the same
//What left and right interface arrows do
Carousel.prototype.keyBoardArrowsEvent = function() {
    var _ = this;

    _.settings.carousel.onkeydown = function(e) {
        var key = e.which || e.keyCode;

        if ( key == 37) {
            _.setActiveAndShow(_.getPreviousObjectId(), false);
        } else if (key == 39) {
            _.setActiveAndShow(_.getNextObjectId(), false);
        }
    }
}

//  Adds click events on left and right arrows
//  tofirst - the arrow that moves the carousel to the first item
//  tolast - the arrow that moves the carousel to the last item
Carousel.prototype.clickEventsArrows = function() {
    var _ = this,
        toFirst = _.settings.toFirst,
        toLast  = _.settings.toLast;

    if (toFirst.addEventListener) {

        toFirst.addEventListener("click", function() {
            _.setActiveAndShow(_.getPreviousObjectId(), false);
        });

        toLast.addEventListener("click", function() {
            _.setActiveAndShow(_.getNextObjectId(), false);
        });

    } else {

        toFirst.attachEvent("onclick", function() {
            _.setActiveAndShow(_.getPreviousObjectId(), false);
        });

        toLast.attachEvent("onclick", function() {
            _.setActiveAndShow(_.getNextObjectId(), false);
        });
    }
}

//Events of holding the mouse on the left and right arrows
Carousel.prototype.holdArrowsEvents = function() {
    var _ = this,
        toFirst = _.settings.toFirst,
        toLast  = _.settings.toLast;

    toFirst.onmousedown = function() {

        var timer = setInterval(function() {
            _.setActiveAndShow(_.getPreviousObjectId(), false);
        },  _.settings.arrowHoldChangeObjectInterval);

        toFirst.onmouseup = function() {
            clearInterval(timer);
        }
        toFirst.onmouseout = function() {
            clearInterval(timer);
        }
    }

    toLast.onmousedown = function() {

        var timer = setInterval(function() {
            _.setActiveAndShow(_.getNextObjectId(), false);
        },  _.settings.arrowHoldChangeObjectInterval);

        toLast.onmouseup = function() {
            clearInterval(timer);
        }
        toLast.onmouseout = function() {
            clearInterval(timer);
        }

    }
}
/* END EVENTS */


//If the object is out of the view and it should be shown,
//This function will move the moving part with the needed amount so the object is shown
Carousel.prototype.showObject = function(objIndex, showAsFirst) {

    var _ = this,
        elem = _.settings.carousel,
        objects = _.settings.objects,
        movingWrapper = _.settings.carousel.querySelector(".moving-wrapper"),
        moving = _.settings.carousel.querySelector(".moving"),
        object = _.settings.objects[objIndex],

        movingWrapperRect = movingWrapper.getBoundingClientRect(),
        objectRect = object.getBoundingClientRect(),

        objectFirst,
        objectSecond,
        movingWFirst,
        movingWSecond,
        dir = _.getDirection();


    objectFirst = (dir == 1) ? objectRect.left : objectRect.top;
    objectSecond = (dir == 1) ? objectRect.right : objectRect.bottom;

    movingWFirst = (dir == 1) ? movingWrapperRect.left : movingWrapperRect.top;
    movingWSecond = (dir == 1) ? movingWrapperRect.right : movingWrapperRect.bottom;

    var nextPos = _.settings.currentRelativePosition; // in case no need for there is not need for showing

    if (objectFirst < movingWFirst) {
        nextPos = _.settings.currentRelativePosition + movingWFirst - objectFirst;
    }

    if (objectSecond > movingWSecond) {
        nextPos = _.settings.currentRelativePosition - (objectSecond - movingWSecond);
    }

    if (showAsFirst) {
        nextPos = movingWFirst - objectFirst;
    }

    if (dir == 1) {
        _.applyCSS(moving, "transform", "translate3d(" + nextPos + "px,0px, 0px)");
    } else {
        _.applyCSS(moving, "transform", "translate3d(0px, " + nextPos + "px, 0px)");
    }

    _.settings.currentRelativePosition = nextPos;


}


/* SETTERS */
//Sets the new object active and the previous one is not active anymore
//Active keyword in the class is reserved
Carousel.prototype.setActive = function(newActive) {
    var _ = this;

    var oldObj = _.settings.objects[_.settings.currentActiveObject];
    oldObj.className = oldObj.className.replace(" active", "");

    var newObj = _.settings.objects[newActive];
    newObj.className = newObj.className.replace(" active", "");
    newObj.className += " active";

    _.settings.currentActiveObject = newActive;
}

//Combines TODO
//@showObject
//@setActive
Carousel.prototype.setActiveAndShow = function(objId, showAsFirst) {
    var _ = this;
    _.setActive(objId);
    _.showObject(objId, showAsFirst);
}

Carousel.prototype.moveToPrevious = function() {
    var _ = this;
    var currentActive = _.settings.currentActiveObject;
    if (currentActive > 0) {
        currentActive--;
        _.settings.currentActiveObject--;
    }
    else {
        currentActive = _.settings.totalObjects - 1;
    }
    _.settings.previousActiveObject = _.settings.currentActiveObject;
    _.settings.curretActiveObject = currentActive;
}

Carousel.prototype.moveToNext = function() {
    var _ = this;
    var currentActive = _.settings.currentActiveObject;
    currentActive++;
    if (currentActive == _.settings.totalObjects) {
        currentActive = 0;
    }
    _.settings.previousActiveObject = _.settings.currentActiveObject;
    _.settings.curretActiveObject = currentActive;
}
/* END SETTERS */



/* GETTERS */
//Horizontal = 1
//Vertical = 2
Carousel.prototype.getDirection = function() {
    var _ = this;

    return (_.settings.direction === "horizontal" ? 1 : 2);

}

//Returns the Id the of the object that is previous to the current one
Carousel.prototype.getPreviousObjectId = function() {
    var _ = this;
    var currentActive = _.settings.currentActiveObject;
    if (currentActive > 0) {
        return currentActive - 1;
    } else {
        return _.settings.totalObjects - 1;
    }
}

//Returns the Id the of the object that is next to the current one
Carousel.prototype.getNextObjectId = function() {
    var _ = this;
    var currentActive = _.settings.currentActiveObject;
    if (currentActive < _.settings.totalObjects - 1) {
        return currentActive + 1;
    } else {
        return 0;
    }
}
/* END GETTERS */


/*
    Makes three copies of the initial array
    COPYLEFT | MAIN | COPYRIGHT
    copyFirst .. | realFirst .. realLast | .. copyLast
    when copyFirst or copyLast gets reached by the spin
    the main moving part gets reseted to it's real copy,
    this way, you can infinitely spin in the same direction
*/
Carousel.prototype.infiniteSpin = function() {
    var _ = this,
        moving = _.settings.moving,
        currArray = _.settings.objects,
        newArray  = [];


    for (var i = 0; i<currArray.length; i++) {
        var newNode = currArray[i].cloneNode(true);
        newArray.push(newNode);
    }
    _.settings.copyFirst = newArray[0]; // the first element in the array that
    // is a copy of the realFirst

    var showNode = null;

    for (var i = 0; i<currArray.length; i++) {
        var newNode = currArray[i].cloneNode(true);
        newNode.className = newNode.className.replace(" active","");
        newArray.push(newNode);
        if (i == 0) {
            showNode = newArray.length - 1;
            _.settings.realFirst = newNode;
            _.settings.realFirstID = showNode;
        }
    }
    _.settings.realLast = newArray[newArray.length-1];
    _.settings.realLastID = newArray.length-1;

    for (var i = 0; i<currArray.length; i++) {
        var newNode = currArray[i].cloneNode(true);
        newArray.push(newNode);
    }
    _.settings.copyLast = newArray[newArray.length-1];

    while (moving.firstChild) {
        moving.removeChild(moving.firstChild);
    }

    for (var i = 0; i<newArray.length; i++) {
        _.settings.moving.appendChild(newArray[i]);
    }

    _.settings.objects = newArray;
    _.settings.totalObjects = newArray.length;
    _.settings.currentActiveObject = _.settings.realFirstID;
    _.clickEvents();
    _.setActiveAndShow(_.settings.realFirstID, true);

}

Carousel.prototype.copyElementsReached = function() {

    var _ = this,
        dir = _.getDirection(),
        copyFirst = _.settings.copyFirst,
        copyLast  = _.settings.copyLast,
        first     = _.settings.realFisrt,
        last      = _.settings.realLast,
        cfb       = copyFirst.getBoundingClientRect(),
        crb       = copyLast.getBoundingClientRect(),
        movingWRect = _.settings.movingWrapper.getBoundingClientRect(),
        copyFirstPos = (dir == 1) ? cfb.left : cfb.top,
        copyLastPos  = (dir == 1) ? crb.right : crb.bottom,
        movingWRectPosFirst = (dir == 1) ? movingWRect.left : movingWRect.right,
        movingWRectPosLast = (dir == 1) ? movingWRect.right : movingWRect.bottom;


        if (copyFirstPos > movingWRectPosFirst) {
            _.showObject(_.settings.realLastID, false);
            return true;
        }
        if (copyLastPos < movingWRectPosLast) {
            _.showObject(_.settings.realFirstID, false);
            return true;
        }
    return false;
}


//Moves the "moving" element of the structure.
//It goes to the left in the positive direction or in the negative,
//Respectively moving left and right
//If the direction is vertical, it will move into top direction
//It will fire the [carouselMoved] event
Carousel.prototype.translateMoving = function(diff) {
    var _ = this;

    var moving = _.settings.moving;
    var movingWrapper = _.settings.movingWrapper;
    var elem = _.settings.carousel;

    if (_.settings.infiniteSpin && _.copyElementsReached()) {
        return true;
    }

    if (_.checkInterval(diff) || _.settings.spinOnLessObjects) {
        _.genEventAndDispatch("carouselMoved", {
            carouselId: elem.id,
            moveAmount: diff,
            direction: _.settings.direction,
        });

        var dir = _.getDirection();

        //If horizontal, move left,
        //If vertical, move top
        _.settings.currentRelativePosition += diff;
        if (_.settings.hasTransform) {
            if (dir == 1) {

                _.applyCSS(moving, "transform", "translate3d("+ _.settings.currentRelativePosition +"px,0px, 0px)");

            } else if (dir == 2) {
                _.applyCSS(moving, "transform", "translate3d(0px,"+ _.settings.currentRelativePosition + "px, 0px)");
            }
        } else {
            if (dir == 1) {
                _.applyCSS(moving, "left", _.settings.currentActivePosition + "px");
            } else if (dir == 2) {
                _.applyCSS(moving, "top", _.settings.currentActivePosition + "px");
            }
        }

    }
}

//Adds inertion moving after the spin
Carousel.prototype.spinInertion = function(lastDiff) {
    var _ = this;
    var diff = (lastDiff < 0) ? -(_.settings.inertionStartSpeed) : _.settings.inertionStartSpeed;
    var dir = _.getDirection();

    var timer = setInterval(function() {
        _.translateMoving(diff);

        if (diff == 0) {
            clearInterval(timer);
        } else {
            diff += (diff > 0) ? -1 : +1;
        }
    }, 20);

}

//Checks is the moving part is actually movable
Carousel.prototype.checkInterval = function(diff) {
    var _ = this;

    var movingWrapper = _.settings.movingWrapper;
    var moving = _.settings.moving;

    var dir = _.getDirection();

    var objectDimension = (dir == 1) ?  moving.querySelector(".object").offsetWidth :
                                        moving.querySelector(".object").offsetHeight;

    var mFirst = (dir == 1) ?   moving.getBoundingClientRect().left:
                                moving.getBoundingClientRect().top;

    var mLast  = (dir == 1) ?   moving.getBoundingClientRect().right:
                                moving.getBoundingClientRect().bottom;

    var wFirst = (dir == 1) ?   movingWrapper.getBoundingClientRect().left:
                                movingWrapper.getBoundingClientRect().top;

    var wLast  = (dir == 1) ?   movingWrapper.getBoundingClientRect().right:
                                movingWrapper.getBoundingClientRect().bottom;

    //If the drag or touch direction was to the first element (negative)
    //Or to the last element (positive)
    var toFirst = (diff < 0);
    var toLast = !toFirst;

                    //It worn't go further than first element and further than the last one
    var response =  (toLast && mFirst + diff < wFirst) || (toFirst && mLast + diff > wLast)
                    &&
                    //If the moving part fits totally in the wrapper, it will not move
                    //Except if spinOnLessObjects is set to true
                    (mLast > wLast || mFirst < wFirst || _.settings.spinOnLessObjects)
    return response;

}

Carousel.prototype.fillWithCopies = function() {


    var _ = this,
        newObjectArray = [],
        movingWrapper = _.settings.movingWrapper,
        movingWRect = movingWrapper.getBoundingClientRect(),
        dir = _.getDirection();
    _.settings.filledWithCopies = true;

    for (var i = 0; i<_.settings.objects.length; i++) {
        var object = _.settings.objects[i];
        newObjectArray.push(object);
    }


    var currentIndex = 0;
    while(true) {

        var lastObject = newObjectArray[newObjectArray.length-1];

        var lastObjectRect = lastObject.getBoundingClientRect();

        var lastParam = (dir == 1) ? lastObjectRect.right : lastObjectRect.bottom;
        var movingWParam = (dir == 1) ? movingWRect.right : movingWRect.bottom;


        if (lastParam < movingWParam) {

            var newNode = _.getCopy(_.settings.objects[currentIndex]);

            newObjectArray.push(newNode);
            _.settings.moving.appendChild(newNode);
            currentIndex++;
            if (currentIndex == _.settings.objects.length) {
                currentIndex = 0;
            }

        } else {
            break;
        }
    }

    while (currentIndex < _.settings.objects.length) {
        var newNode = _.getCopy(_.settings.objects[currentIndex]);

        newObjectArray.push(newNode);
        _.settings.moving.appendChild(newNode);
        currentIndex++;
    }
    _.settings.objects = newObjectArray;
}


Carousel.prototype.applyCSS = function(element, key, value, needsPrefixes) {
    element.style[key] = value;
    var prefixes = ["Webkit", "Moz", "ms", "O"];

    if (needsPrefixes) {
        key[0] = key[0].toUpperCase();
        for (var prefix in prefixes) {
            element.style[prefix + key] = value;
        }
    }
}

Carousel.prototype.detectCSSFeature = function(featurename){
    var feature = false,
    domPrefixes = 'Webkit Moz ms O'.split(' '),
    elm = document.createElement('div'),
    featurenameCapital = null;

    featurename = featurename.toLowerCase();

    if( elm.style[featurename] !== undefined ) { feature = true; }

    if( feature === false ) {
        featurenameCapital = featurename.charAt(0).toUpperCase() + featurename.substr(1);
        for( var i = 0; i < domPrefixes.length; i++ ) {
            if( elm.style[domPrefixes[i] + featurenameCapital ] !== undefined ) {
              feature = true;
              break;
            }
        }
    }
    return feature;
}

Carousel.prototype.getCopy = function(node) {

    var newNode = node.cloneNode(true);
    newNode.className =  newNode.className.replace(" active", "");
    return newNode;

}






