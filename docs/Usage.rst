-----------------------
Browsing OMERO datasets
-----------------------

OMERO tranditionally organizes image data in projects, datasets and files. Projects and datasets can be used to organize your workspace whereas files represent the actual image data, for example your time-lapse image stack.
We provide dashboards to browse both projects and datasets of your OMERO instance to locate the files that you are interested (see figure). Once you open a file you can start your annotations.

TODO: Add figure of dashboards

------------------------
Navigating the viewport
------------------------

Once you open an omero file you will see the main operating window of |tool| (see figure). It is designed in three vertical pieces:

1. The toolbar gives the path to the dataset as well as it provides all important tools such as Import/Export with OMERO, Brush, Semi-automated segmentation, Redo/Undo.
2. The image view visualizes the current image with all its annotations. It allows to navigate the viewport by translation (press the mousewheel and drag), zooming (scroll mouse wheel) or pinch and zoom gestures on touch devices.
3. The bottom bar visualizes the timeline of the time-lapse recording and allows you to manoveur back and forth or jump to a certain location in time.

-----------------------
Tools
-----------------------

|tool| comes pre-equipped with several tools to simplify the image annotations

^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Image annotation using brush tool
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To enable the brush mode click the brush button in the toolbar (top-right). This opens a dialog to configure the brush tool:

1. The `Show Overlay` option allows to show or hide the overlay to better inspect the raw image below the annotated overlay.
2. The `Prevent Overlap` option allows to choose whether you would like to allow or forbid overlapping annotations. When activated it will prevent overlapping annotations on the go while you are drawing.
3. The `Brush Size` option allows you to configure your brush size in pixels to adapt to different sizes of objects in the image.

To create a new annoation press `Enter` or click the checkmark in the top right of the toolbar. Now start to drag your mouse cursor over the area you would like to annotate and the overlay (colored randomly) will appear.

To increase an existing annotation, first click inside the anotation to select it. If you would like to increase the area of your annotation start the drawing process inside the overlay. If you would like to decrease the area start drawing from the outside. Remember that you have to drag for drawing, not click as this might select another cell.

^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Semi-automated annotation: Starting with proposals
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To request proposals from an already trained instance segmentation model click the `ADV-SEG` button (rocket symbol). This opens a dialog that allows you to configure the proposal generation.

1. Click the `Request Proposals` button to send the current image to the deep-learning model and wait for the results. This may take some seconds because the data has to be transfered via the network and the deep-learning model is executed.
2. When finished, the dialog will show some stats about the proposals. `Total detections` shows the number of raw detections produced by the deep-learning approach. `Filtered detections` shows the number of detections obtained after an IoU filtering step to prevent overlapping proposals.
3. The IoU filtering can be enabled/disabled with the `Filter Overlaps` option.
4. The two buttons `Show Existing Overlay` and `Show New Overlay` allow to visualize the different overlays. The new overlay is provided by the deep-learning proposals while the existing overlay shows the existing annotations before proposal generation.
5. The threshold slider allows to filter the proposals by their score ranging from 0 to 1 where 0 denotes very uncertain proposal and 1 denotes a very certain proposal. The slider can be used to find an appropriate threshold. Keep in mind that filtering can take a little for thousands of cells.
6. The `Commit` button finally allows to commit the visualization that you currently see to the data model. Note that this action can be reverted using the undo button.


^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Removing Artifacts: The rectangle selection tool
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The semi-automated proposal generation can lead to a number of artifacts, especially if the image data differs largely from the deep-learning training data. To efficiently remove these artifacts we have implemented a rectangular multiselection tool.

1. Click the rectangle symbol in the tool-bar
2. Draw a rectangle by drag and drop. You already see that all the annotations are selected.
3. Press the delete button to delete all annotations or artifacts at once.

Note that you can also delete individual annotations by selecting them (single click inside) and pressing the deletion key. On touch devices a long press in the annotation will open a menu for deletion. And whenever you deleted the wrong things, simply revert your action (top-right).

-----------------------------------------------------
Interfacing with Omero: Import/Export
-----------------------------------------------------

The |tool| utilizes a data format specialized to record the sequential modifications to support redo/undo operations and attaches the data automatically to the image in OMERO. To utilize the official OMERO Region of Interest (RoI) format, |tool| supports to import or export annotation data.


^^^^^^^^^^^^^^^^^^^^^^^^^
Import from OMERO
^^^^^^^^^^^^^^^^^^^^^^^^^

|tool| Automatically checks for existing OMERO annotations when you open the image file for the first time and offers you to import any existing polygon annotations. If you manually want to import that data again at a later time (for example you applied a new Fiji segmentation model and want to correct the annotations) you can simply click the `Import` button. This will delete all existing annotations and import all the OMERO annotations.

^^^^^^^^^^^^^^^^^^^^^^^^^
Export to OMERO
^^^^^^^^^^^^^^^^^^^^^^^^^

Export to OMERO is as easy as to click the `Export` button. |tool| will get back to you if there are existing annotations and get an additional approval to overwrite any exisiting annotations. The exported annotations can be visualized in the OME tools or with third-party applications, for example, Fiji.

.. |tool| replace:: replacement *SegUI*