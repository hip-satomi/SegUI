=====================
Installation
=====================

-----------------------
Quick Installation
-----------------------

The easiest way to install |tool| is together with a OMERO instance for data serving.
To quickly build and install all necessary dependencies for |tool| and OMERO just execute:

.. code-block:: bash
    
    > docker-compose -f ./docker-compose/docker-compose.full.yml up --build

You can reach the local segTrack app `here <http://localhost>`_ and the omero web `here <http://localhost:4080>`_. The username is `root` and the password is `omero` for the standard user.


--------------------------------------
Integrating into existing OMERO setup
--------------------------------------

You can also integrate the |tool| into an existing OMERO installation. Assume the current OMERO web interface runs at `localhost:4080 <http://localhost:4080>`. To attach to that running instance just run

.. code-block:: bash

    > docker run --rm -it --network host -e OMERO_URL=localhost:4080 --pull always jugit-registry.fz-juelich.de/satomi/segtrackui/server:latest

TODO: change docker image location