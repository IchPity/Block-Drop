package actions;

import gui.Gui;

import java.awt.*;

public class Mouse {

    public static Point pos = new Point();
    public static boolean insideField = false;

    public static Point ctp(Point p) {
        Point point = new Point(0,0);

        point.x = (p.x - Gui.fieldx) / 80;
        point.y = (p.y - Gui.fieldy) / 80;

        return point;

    }

    public static Point ptc(Point p) {
        Point point = new Point(0,0);

        point.x = (p.x * 80) + Gui.fieldx;
        point.y = (p.y * 80) + Gui.fieldy;

        return point;

    }

    public static boolean insideField(int x, int y) {


        return (x > Gui.fieldx && x < Gui.fieldx + Gui.fieldsize && y > Gui.fieldy && y < Gui.fieldy + Gui.fieldsize);

    }
}
